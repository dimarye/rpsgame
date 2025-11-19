import json
import logging
import asyncio
import random
from functools import wraps
from django.utils import timezone
from urllib.parse import parse_qs
from typing import Optional, Dict, Any, List, Tuple, Type, TypeVar, Callable, Awaitable, cast
from django.core.exceptions import ValidationError
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.db import transaction, DatabaseError, OperationalError
from django.db.models import Q, F
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
from .models import Match, Move

logger = logging.getLogger(__name__)
User = get_user_model()

# Type variables for generic decorator
T = TypeVar('T')
P = TypeVar('P')

# Constants
MAX_RETRIES = 3
RETRY_DELAY = 0.1  # seconds
LOCK_TIMEOUT = 5  # seconds

class RetryableError(Exception):
    """Exception that can be retried."""
    pass

class NonRetryableError(Exception):
    """Exception that should not be retried."""
    pass

def retry_on_deadlock(max_retries: int = MAX_RETRIES, base_delay: float = RETRY_DELAY) -> Callable:
    """Decorator to retry database operations on deadlock or serialization errors."""
    def decorator(func: Callable[..., Awaitable[T]]) -> Callable[..., Awaitable[T]]:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> T:
            retries = 0
            last_exception = None
            while retries <= max_retries:
                try:
                    return await func(*args, **kwargs)
                except (DatabaseError, OperationalError) as e:
                    if retries >= max_retries:
                        logger.error(f"Max retries ({max_retries}) reached in {func.__name__}")
                        raise
                    # Check if this is a retryable error
                    error_msg = str(e).lower()
                    is_deadlock = 'deadlock' in error_msg
                    is_serialization = hasattr(e, 'pgcode') and e.pgcode in ('40001', '40P01')
                    is_timeout = 'timeout' in error_msg or 'lock timeout' in error_msg
                    if not (is_deadlock or is_serialization or is_timeout):
                        logger.error(f"Non-retryable database error in {func.__name__}: {e}")
                        raise
                    retries += 1
                    delay = min(base_delay * (2 ** (retries - 1)) + random.uniform(0, 0.1), 1.0)
                    logger.warning(
                        f"Retryable error in {func.__name__} (attempt {retries}/{max_retries}): {e}"
                    )
                    await asyncio.sleep(delay)
                    last_exception = e
                except Exception as e:
                    logger.error(f"Unexpected error in {func.__name__}: {e}", exc_info=True)
                    raise
            logger.error(f"Exhausted all retries in {func.__name__}")
            raise last_exception if last_exception else Exception("Unknown error in retry handler")
        return wrapper
    return decorator
