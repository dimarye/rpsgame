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

class MatchConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for handling Rock-Paper-Scissors game matches."""

    async def connect(self):
        """Handle WebSocket connection with JWT authentication."""
        # Log the connection attempt with connection details
        logger.info(f"[WEBSOCKET] New connection attempt - Scope: {self.scope}")
        
        try:
            self.match_id = self.scope['url_route']['kwargs']['match_id']
            self.match_group_name = f'match_{self.match_id}'
            logger.info(f"[WEBSOCKET] Processing connection for match {self.match_id}")

            # Parse query parameters
            query_string = self.scope.get('query_string', b'').decode()
            logger.info(f"[WEBSOCKET] Raw query string: {query_string}")
            
            query_params = parse_qs(query_string)
            token = query_params.get('token', [None])[0]
            
            if not token:
                error_msg = "No token provided in WebSocket connection"
                logger.warning(f"[WEBSOCKET] {error_msg}")
                await self.close(code=4001)  # Invalid auth
                return

            # Authenticate user
            logger.info(f"[WEBSOCKET] Authenticating user with token: {token[:10]}...")
            self.user = await self.get_user_from_token(token)
            if not self.user:
                logger.warning(f"[WEBSOCKET] Invalid token for match {self.match_id}")
                await self.close(code=4001)
                return

            # Get fresh match data
            logger.info(f"[WEBSOCKET] Fetching match data for match {self.match_id}")
            self.match = await self.get_match()
            if not self.match:
                logger.warning(f"[WEBSOCKET] Match {self.match_id} not found")
                await self.close(code=4004)
                return

            # Check if user can join the match
            if not await self.can_join_match():
                logger.warning(f"[WEBSOCKET] User {self.user.username} cannot join match {self.match_id}")
                await self.close(code=4003)
                return

            # Add to match group
            await self.channel_layer.group_add(
                self.match_group_name,
                self.channel_name
            )

            # Accept the connection
            await self.accept()
            logger.info(f"[WEBSOCKET] Connection accepted for user {self.user.username} in match {self.match_id}")

            # Notify group that a player has joined
            await self.channel_layer.group_send(
                self.match_group_name,
                {
                    'type': 'player_joined',
                    'player_id': self.user.id,
                    'username': self.user.username
                }
            )

            # Send current match state
            await self.broadcast_match_state()

        except KeyError as e:
            logger.error(f"[WEBSOCKET] Missing required parameter: {str(e)}", exc_info=True)
            await self.close(code=4000)
        except Exception as e:
            logger.error(f"[WEBSOCKET] Unexpected error in connect: {str(e)}", exc_info=True)
            await self.close(code=4000)

            # Add to match group
            await self.channel_layer.group_add(
                self.match_group_name,
                self.channel_name
            )

            # Accept the connection
            await self.accept()
            logger.info(f"WebSocket connection accepted for user {self.user.username} in match {self.match_id}")

            # Notify group that a player has joined
            await self.channel_layer.group_send(
                self.match_group_name,
                {
                    'type': 'player_joined',
                    'player_id': self.user.id,
                    'username': self.user.username
                }
            )

            # Send current match state
            await self.broadcast_match_state()

        except Exception as e:
            logger.error(f"Error in WebSocket connect: {str(e)}", exc_info=True)
            await self.close(code=4000)

    async def disconnect(self, close_code):
        """Handle WebSocket disconnect."""
        if hasattr(self, 'match_group_name'):
            await self.channel_layer.group_discard(
                self.match_group_name,
                self.channel_name
            )
            logger.info(f"WebSocket disconnected for user {getattr(self, 'user', 'unknown')} in match {getattr(self, 'match_id', 'unknown')}")

        await super().disconnect(close_code)

    async def handle_move(self, data: Dict[str, Any]) -> None:
        """Handle move message from WebSocket with transaction support."""
        try:
            logger.info(f"[DEBUG] Received move request: {data} from user {getattr(self, 'user', 'unknown')}")

            # Validate the move data
            choice = data.get('choice')
            if not choice or choice.lower() not in ['rock', 'paper', 'scissors']:
                error_msg = f"Invalid move: {choice}. Please choose 'rock', 'paper', or 'scissors'."
                logger.warning(error_msg)
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'code': 'INVALID_MOVE',
                    'message': error_msg
                }))
                return

            # Get fresh match data with row lock to prevent race conditions
            logger.info(f"[DEBUG] Getting fresh match data for match_id: {getattr(self, 'match_id', 'unknown')}")
            self.match = await self.get_match(for_update=True)
            if not self.match:
                error_msg = "Match not found"
                logger.error(error_msg)
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'code': 'MATCH_NOT_FOUND',
                    'message': error_msg
                }))
                await self.close()
                return

            # Check if match is already finished
            if self.match.status == Match.Status.FINISHED:
                error_msg = "This match has already ended"
                logger.warning(f"{error_msg} (match {self.match_id})")
                await self.send_error(error_msg)
                # Still broadcast the current state in case client is out of sync
                await self.broadcast_match_state()
                return

            # Initialize variables
            move = None
            is_match_finished = False
            
            # Save the move and check if the match is finished
            try:
                logger.info(f"[DEBUG] Processing move '{choice}' for user {self.user.username} in match {self.match_id}")
                move, is_match_finished = await self._save_move_with_winner_check(choice)
                if not move:
                    error_msg = "Failed to save move"
                    logger.error(error_msg)
                    await self.send_error(error_msg)
                    return
                logger.info(f"[DEBUG] Move saved successfully: {move.id} by {self.user.username}")

                # Always broadcast the updated match state first
                logger.info("[DEBUG] Broadcasting updated match state...")
                await self.broadcast_match_state()

                # If match is finished, send match completed message
                if is_match_finished:
                    logger.info("[DEBUG] Match finished! Sending completion event...")
                    # Refresh match data to ensure we have the latest state
                    self.match = await self.get_match()
                    if self.match and self.match.status == Match.Status.FINISHED:
                        logger.info("[DEBUG] Sending match_completed message to all clients...")
                        await self.send_match_completed()
                    else:
                        logger.warning("[DEBUG] Match is not marked as finished in the database, not sending match_completed")
                else:
                    logger.info("[DEBUG] Waiting for other player's move...")

            except ValueError as e:
                error_msg = str(e)
                error_code = 'DUPLICATE_MOVE' if 'already made your move' in error_msg else 'INVALID_MOVE'
                logger.warning(f"Move validation error ({error_code}): {error_msg}")
                
                # Get fresh match state to check if match is finished
                try:
                    match = await self.get_match()
                    if match:
                        is_match_finished = match.status == Match.Status.FINISHED
                        logger.info(f"[DEBUG] Match status: {match.status}, is_finished: {is_match_finished}")
                    else:
                        logger.warning("Match not found when checking status")
                        is_match_finished = False
                except Exception as e:
                    logger.error(f"Error getting match status: {str(e)}")
                    is_match_finished = False
                
                # Send detailed error response to the client
                error_response = {
                    'type': 'error',
                    'code': error_code,
                    'message': error_msg,
                    'match_id': str(self.match_id)
                }
                logger.info(f"[DEBUG] Sending error response: {error_response}")
                await self.send(text_data=json.dumps(error_response))
                
                # For non-duplicate move errors, broadcast the updated state
                if error_code != 'DUPLICATE_MOVE':
                    logger.info("[DEBUG] Broadcasting updated match state after non-duplicate error")
                    await self.broadcast_match_state()
                
                # If match is finished, send completion event
                if is_match_finished:
                    logger.info("[DEBUG] Match is finished, sending completion event")
                    await self.send_match_completed()
                
                # Return without closing the connection
                return

            except Exception as e:
                error_msg = f"Error processing move: {str(e)}"
                logger.error(error_msg, exc_info=True)
                await self.send_error("An error occurred while processing your move")
                # Still broadcast the current state in case of error
                await self.broadcast_match_state()

        except Exception as e:
            error_msg = f"Unexpected error in handle_move: {str(e)}"
            logger.error(error_msg, exc_info=True)
            await self.send_error("An unexpected error occurred")
            # Try to broadcast the current state if possible
            try:
                await self.broadcast_match_state()
            except Exception as broadcast_error:
                logger.error(f"Failed to broadcast state after error: {str(broadcast_error)}")

    async def receive(self, text_data):
        """Handle WebSocket message receive."""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            if message_type == 'move':
                await self.handle_move(data)
            elif message_type == 'ping':
                await self.send(text_data=json.dumps({'type': 'pong'}))
            else:
                logger.warning(f"Unknown message type: {message_type}")
                await self.send_error("Unknown message type")
        except json.JSONDecodeError:
            logger.warning("Received invalid JSON in WebSocket message")
            await self.send_error("Invalid JSON")
        except Exception as e:
            logger.error(f"Error processing WebSocket message: {str(e)}", exc_info=True)
            await self.send_error("Internal server error")

    # Database access methods
    @database_sync_to_async
    def get_user_from_token(self, token):
        """Get user from JWT token."""
        try:
            logger.info(f"[AUTH] Validating token: {token[:10]}...")  # Log first 10 chars for security
            access_token = AccessToken(token)
            logger.info(f"[AUTH] Token validated for user_id: {access_token['user_id']}")
            user = User.objects.get(id=access_token['user_id'])
            logger.info(f"[AUTH] User found: {user.username} (ID: {user.id})")
            return user
        except TokenError as e:
            logger.error(f"[AUTH] Token validation failed (TokenError): {str(e)}")
            return None
        except InvalidToken as e:
            logger.error(f"[AUTH] Token validation failed (InvalidToken): {str(e)}")
            return None
        except User.DoesNotExist as e:
            logger.error(f"[AUTH] User not found for token: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"[AUTH] Unexpected error during token validation: {str(e)}", exc_info=True)
            return None

    @database_sync_to_async
    def get_match(self, for_update: bool = False, skip_locked: bool = False):
        """Get fresh match data from the database with optional row locking.
        Args:
            for_update: If True, lock the row for update
            skip_locked: If True, skip locked rows (only used with for_update)
        Returns:
            Match instance or None if not found
        """
        try:
            with transaction.atomic():
                qs = Match.objects.select_related('player1', 'player2', 'winner')
                if for_update:
                    qs = qs.select_for_update(
                        skip_locked=skip_locked,
                        of=('self',),
                        nowait=not skip_locked
                    )
                match = qs.get(id=self.match_id)
                # Force evaluation of related fields to avoid potential lazy loading issues
                if match.player1:
                    _ = match.player1.username
                if match.player2:
                    _ = match.player2.username
                if match.winner:
                    _ = match.winner.username
                return match
        except Match.DoesNotExist:
            logger.error(f"Match {self.match_id} not found")
            return None
        except Exception as e:
            logger.error(f"Error getting match {self.match_id}: {str(e)}", exc_info=True)
            return None

    @database_sync_to_async
    def get_match_player1(self):
        """Safely get player1 from match."""
        if not hasattr(self, 'match') or not self.match:
            return None
        return self.match.player1

    @database_sync_to_async
    def get_match_player2(self):
        """Safely get player2 from match."""
        if not hasattr(self, 'match') or not self.match:
            return None
        return self.match.player2

    @database_sync_to_async
    def get_match_status(self):
        """Safely get match status."""
        if not hasattr(self, 'match') or not self.match:
            return None
        return self.match.status

    @database_sync_to_async
    def get_last_move(self):
        """Get the most recent move with related player data."""
        try:
            with transaction.atomic():
                return (Move.objects.filter(match_id=self.match_id)
                                 .select_related('player')
                                 .order_by('-timestamp')
                                 .first())
        except Exception as e:
            logger.error(f"Error getting last move for match {self.match_id}: {str(e)}")
            return None

    @database_sync_to_async
    def get_match_moves(self):
        """Get all moves for the match with related player data."""
        try:
            with transaction.atomic():
                moves = list(Move.objects.filter(match_id=self.match_id)
                                     .select_related('player')
                                     .order_by('timestamp'))
                # Force evaluation of related fields
                for move in moves:
                    if move.player:
                        _ = move.player.username
                return moves
        except Exception as e:
            logger.error(f"Error getting moves for match {self.match_id}: {str(e)}")
            return []

    @database_sync_to_async
    def save_move(self, choice):
        """Save a move to the database."""
        match = Match.objects.get(id=self.match_id)
        return Move.objects.create(match=match, player=self.user, choice=choice)

    @database_sync_to_async
    def _save_winner(self, winner_move):
        """Synchronously save the match winner."""
        match = Match.objects.get(id=self.match_id)
        match.winner = winner_move.player
        match.status = Match.Status.FINISHED
        match.save(update_fields=['winner', 'status', 'updated_at'])
        return match

    # Game logic methods
    async def can_join_match(self):
        """Check if user can join the match using async-safe methods."""
        if not hasattr(self, 'match') or not self.match:
            return False
        player1 = await self.get_match_player1()
        player2 = await self.get_match_player2()

        # User is player1 or player2
        if player1 == self.user or player2 == self.user:
            return True
        # Or match needs a player2 and user is not player1
        if not player2 and player1 != self.user:
            return True
        return False

    # УБРАНО: @database_sync_to_async def _save_player2_assignment(self) ...
    # УБРАНО: async def assign_player2_if_needed(self) ...

    @database_sync_to_async
    def determine_winner_sync(self, move1, move2):
        """Synchronous method to determine the winner between two moves."""
        from .views import determine_winner as determine_winner_view
        return determine_winner_view(move1, move2)

    @database_sync_to_async
    def _is_players_turn_sync(self, last_move):
        """Synchronously check if it's the current user's turn.
        Note: For Rock-Paper-Scissors, this is not strictly needed as players can move
        in any order, but we keep it for compatibility.
        """
        if not hasattr(self, 'match') or not self.match:
            return False
        # If match is finished, no more moves allowed
        if self.match.status == Match.Status.FINISHED:
            return False
        # For RPS, as long as the player hasn't moved yet, it's their turn
        if last_move and last_move.player.id == self.user.id:
            return False
        return True

    async def is_players_turn(self):
        """Check if it's the current user's turn using async-safe methods."""
        if not hasattr(self, 'match') or not self.match:
            return False
        last_move = await self.get_last_move()
        return await self._is_players_turn_sync(last_move)

    # WebSocket message handlers
    @database_sync_to_async
    def _determine_winner_sync(self, move1: Move, move2: Move) -> Optional[str]:
        """Synchronously determine the winner between two moves.
        Args:
            move1: First player's move
            move2: Second player's move
        Returns:
            'player1' if move1 wins, 'player2' if move2 wins, or None for a tie
        """
        if not all([move1, move2]):
            logger.error("One or both moves are None")
            return None

        # Normalize choices to lowercase and strip whitespace
        choice1 = move1.choice.lower().strip() if move1.choice else ''
        choice2 = move2.choice.lower().strip() if move2.choice else ''

        # Validate choices
        valid_choices = {'rock', 'paper', 'scissors'}
        if choice1 not in valid_choices or choice2 not in valid_choices:
            logger.error(f"Invalid move choices: {choice1} vs {choice2}")
            return None

        # Log the moves being compared
        logger.info(f"[DEBUG] Determining winner: {choice1} vs {choice2}")

        if choice1 == choice2:
            logger.info("[DEBUG] Game result: Tie")
            return None

        winning_moves = {
            'rock': 'scissors',
            'scissors': 'paper',
            'paper': 'rock'
        }

        if winning_moves[choice1] == choice2:
            logger.info("[DEBUG] Game result: Player 1 wins")
            return 'player1'
        logger.info("[DEBUG] Game result: Player 2 wins")
        return 'player2'

    @database_sync_to_async
    def _save_move_with_winner_check(self, choice: str) -> Tuple[Optional[Move], bool]:
        """Save move and check for winner with transaction support.
        Args:
            choice: The move choice (rock, paper, or scissors)
        Returns:
            Tuple of (saved_move, is_match_finished)
        Raises:
            ValueError: If the move is invalid or duplicate
            RuntimeError: For other unexpected errors
        """
        try:
            with transaction.atomic():
                logger.info(f"[DEBUG] Starting _save_move_with_winner_check for user {getattr(self.user, 'username', 'unknown')} "
                          f"in match {getattr(self, 'match_id', 'unknown')}")

                # Get fresh match data with select_for_update to lock the row
                match = Match.objects.select_for_update().get(id=self.match_id)
                logger.info(f"[DEBUG] Retrieved match {match.id} with status {match.status}")

                # Check if match is already finished
                if match.status == Match.Status.FINISHED:
                    logger.warning(f"Match {match.id} is already finished")
                    return None, True

                # Get all moves for this match
                moves = list(Move.objects.filter(match_id=match.id).select_related('player').order_by('timestamp'))
                logger.info(f"[DEBUG] Found {len(moves)} existing moves for match {match.id}")

                # Check if the player has already moved in this match
                player_moves = [m for m in moves if m.player_id == self.user.id]
                if player_moves:
                    logger.warning(f"User {self.user.username} already has {len(player_moves)} moves in match {match.id}")
                    raise ValueError("You have already made your move in this match")

                # Validate the move choice
                normalized_choice = choice.lower().strip()
                if normalized_choice not in {'rock', 'paper', 'scissors'}:
                    logger.warning(f"Invalid move choice: {choice}")
                    raise ValueError("Invalid move. Please choose 'rock', 'paper', or 'scissors'")

                # 🔥 ИСПРАВЛЕНО: Динамическое назначение player2 *внутри транзакции* сразу при первом ходе, если не назначен
                if not match.player2 and self.user != match.player1:
                    logger.info(f"[DEBUG] Dynamically assigning {self.user.username} as player2 in match {match.id}")
                    match.player2 = self.user
                    match.status = Match.Status.ACTIVE # Устанавливаем статус ACTIVE при первом ходе второго игрока
                    match.save(update_fields=['player2', 'status', 'updated_at'])

                # Create the move
                move = Move.objects.create(
                    match_id=match.id,
                    player=self.user,
                    choice=normalized_choice,
                    timestamp=timezone.now()
                )
                moves.append(move)
                logger.info(f"[DEBUG] Created move {move.id} for user {self.user.username} in match {match.id}")

                # 🔥 ИСПРАВЛЕНО: Проверка завершения матча на основе уникальных игроков, а не только match.player2
                # Это надёжнее, чем проверять match.player2, т.к. он может быть не обновлён в БД в момент первого хода
                players_who_moved = {m.player_id for m in moves}
                num_players_moved = len(players_who_moved)

                # Теперь мы уверены, что у нас есть оба игрока (player1 и player2) в match, т.к. это произошло при первом ходе
                if num_players_moved >= 2:
                    logger.info(f"[DEBUG] Both players have moved in match {match.id}, determining winner...")
                    # Get moves from both players based on the match's player1 and player2
                    player1_move = next((m for m in moves if m.player_id == match.player1_id), None)
                    player2_move = next((m for m in moves if m.player_id == match.player2_id), None) # Используем match.player2_id

                    if player1_move and player2_move:
                        logger.info(f"[DEBUG] Player 1 ({match.player1.username}) chose {player1_move.choice}")
                        logger.info(f"[DEBUG] Player 2 ({match.player2.username}) chose {player2_move.choice}")

                        # Determine the winner using the game rules
                        choice1 = player1_move.choice.lower().strip()
                        choice2 = player2_move.choice.lower().strip()
                        
                        logger.info(f"[DEBUG] Determining winner: {choice1} vs {choice2}")
                        
                        winning_moves = {
                            'rock': 'scissors',     # Rock crushes scissors
                            'scissors': 'paper',    # Scissors cut paper
                            'paper': 'rock'         # Paper covers rock
                        }
                        
                        if choice1 == choice2:
                            logger.info("[DEBUG] The game is a draw!")
                            match.winner = None
                        elif winning_moves[choice1] == choice2:
                            match.winner = match.player1
                            logger.info(f"[DEBUG] Player 1 ({match.player1.username}) wins with {choice1} against {choice2}!")
                        else:
                            match.winner = match.player2
                            logger.info(f"[DEBUG] Player 2 ({match.player2.username}) wins with {choice2} against {choice1}!")
                        
                        # Update match status
                        match.status = Match.Status.FINISHED
                        
                        # Save the updated match
                        match.save(update_fields=['status', 'winner', 'updated_at'])
                        match.refresh_from_db()  # Ensure we have the latest data
                        logger.info(f"[DEBUG] Match {match.id} finished. Winner: {getattr(match.winner, 'username', 'draw')}")
                        return move, True
                    else:
                        logger.warning("Could not find moves for both players (player1_move or player2_move is None)")
                        # Это может произойти, если игроки не player1 и player2, но это маловероятно после динамического назначения
                        # Но на всякий случай, если логика сортировки по ID сбита, возвращаем False
                logger.info(f"[DEBUG] Match {match.id} - Waiting for other player's move")
                return move, False

        except Exception as e:
            logger.error(f"Error in _save_move_with_winner_check: {str(e)}", exc_info=True)
            if isinstance(e, (ValueError, ValidationError)):
                raise ValueError(str(e))
            raise RuntimeError("An error occurred while processing your move")

    @retry_on_deadlock(max_retries=MAX_RETRIES)
    @database_sync_to_async
    def _save_winner(self, winner_move: Move) -> Optional[Match]:
        """Synchronously save the match winner with transaction support.
        Args:
            winner_move: The winning move
        Returns:
            Updated Match instance or None if failed
        """
        try:
            with transaction.atomic():
                # Get fresh match data with row lock
                match = Match.objects.select_for_update(
                    skip_locked=False,  # Wait for lock
                    of=('self',),  # Only lock the match row
                    nowait=False
                ).select_related('player1', 'player2', 'winner').get(id=self.match_id)

                # Double-check the match isn't already finished
                if match.status == Match.Status.FINISHED:
                    logger.warning(
                        f"Match {match.id} is already finished, "
                        f"winner: {getattr(match.winner, 'username', 'None')}"
                    )
                    return match

                # Update match with winner and status
                match.winner = winner_move.player
                match.status = Match.Status.FINISHED
                match.updated_at = timezone.now()

                # Use update_fields to ensure we only update what's needed
                match.save(update_fields=['winner', 'status', 'updated_at'])
                logger.info(
                    f"Updated match {match.id} winner to {winner_move.player.username}"
                )

                # Return the updated match with all related fields
                return Match.objects.select_related('player1', 'player2', 'winner').get(pk=match.pk)
        except Match.DoesNotExist:
            logger.error(f"Match {self.match_id} not found when saving winner")
            return None
        except Exception as e:
            logger.error(f"Error saving winner: {str(e)}", exc_info=True)
            raise

    async def update_match_winner(self, winner_move: Move) -> Optional[Match]:
        """Update match with the winner and set status to FINISHED.
        Args:
            winner_move: The winning move
        Returns:
            The updated match or None if update failed
        """
        if not winner_move or not hasattr(self, 'match'):
            logger.warning("Invalid winner_move or no match in update_match_winner")
            return None

        try:
            logger.info(f"Updating match winner to {winner_move.player.username}")

            # Save the winner and get the updated match in a transaction
            updated_match = await self._save_winner(winner_move)

            # Ensure we have the latest match state with all related fields
            self.match = await self.get_match()

            # Verify the update was successful
            if not self.match:
                logger.error("Failed to fetch updated match data")
                return None
            if self.match.status != Match.Status.FINISHED or self.match.winner_id != winner_move.player_id:
                logger.error(f"Match winner update failed! Status: {self.match.status}, "
                            f"Winner ID: {self.match.winner_id}, Expected: {winner_move.player_id}")
                return None

            logger.info(f"Successfully updated match winner to {winner_move.player.username}")

            # Broadcast the final state to all clients with retry
            await self.broadcast_match_state()
            return updated_match
        except Exception as e:
            logger.error(f"Error in update_match_winner: {str(e)}", exc_info=True)
            # Still try to broadcast the state even if there was an error
            try:
                await self.broadcast_match_state()
            except Exception as broadcast_error:
                logger.error(f"Error broadcasting match state after update error: {str(broadcast_error)}")
            return None

    @database_sync_to_async
    def _prepare_broadcast_message(self, match_data: Dict[str, Any]) -> Dict[str, Any]:
        """Synchronously prepare the full broadcast message with player data.
        Args:
            match_data: Dictionary containing match state data
        Returns:
            Complete message dictionary for broadcasting
        """
        try:
            return {
                'type': 'match_state',
                'match_id': str(self.match.id),
                'status': match_data['status'],
                'moves': match_data.get('moves', []),
                'winner': match_data.get('winner'),
                'player1': {
                    'id': str(self.match.player1.id),
                    'username': self.match.player1.username
                } if self.match.player1 else None,
                'player2': {
                    'id': str(self.match.player2.id) if self.match.player2 else None,
                    'username': self.match.player2.username if self.match.player2 else None
                } if self.match.player2 else None,
                'created_at': self.match.created_at.isoformat() if self.match.created_at else None,
                'updated_at': self.match.updated_at.isoformat() if self.match.updated_at else None
            }
        except Exception as e:
            logger.error(f"Error preparing broadcast message: {str(e)}", exc_info=True)
            # Return minimal message on error
            return {
                'type': 'match_state',
                'match_id': str(getattr(self, 'match_id', 'unknown')),
                'status': match_data.get('status', 'error'),
                'moves': match_data.get('moves', []),
                'winner': None,
                'player1': None,
                'player2': None
            }

    @database_sync_to_async
    def _get_match_state_data(self, match: Match, moves: list[Move]) -> Optional[Dict[str, Any]]:
        """Synchronously prepare match state data with proper error handling.
        Args:
            match: The match instance
            moves: List of Move instances for this match
        Returns:
            Dictionary containing match state or None if an error occurs
        """
        try:
            if not match:
                logger.warning("No match provided to _get_match_state_data")
                return None

            # Make sure we have the match ID for logging
            match_id = getattr(match, 'id', 'unknown')

            try:
                # Only refresh if the match has an ID
                if match_id != 'unknown':
                    match.refresh_from_db()
            except Match.DoesNotExist:
                logger.error(f"Match {match_id} no longer exists")
                return None
            except Exception as e:
                logger.error(f"Error refreshing match {match_id} data: {str(e)}")
                # Continue with potentially stale data rather than failing

            # Safely prepare moves data
            moves_data = []
            for move in moves:
                try:
                    # Ensure we have the player data loaded
                    if not hasattr(move, 'player') or not move.player:
                        logger.warning(f"Move {getattr(move, 'id', 'unknown')} has no player")
                        continue
                    moves_data.append({
                        'player_id': move.player.id,
                        'choice': move.choice,
                        'timestamp': move.timestamp.isoformat(),
                        'player_username': move.player.username
                    })
                except Exception as e:
                    logger.warning(f"Error processing move {getattr(move, 'id', 'unknown')}: {str(e)}")
                    continue

            # Safely prepare winner data
            winner_data = None
            try:
                if hasattr(match, 'winner_id') and match.winner_id:
                    # Ensure winner is loaded
                    if not hasattr(match, 'winner') or not match.winner:
                        logger.warning(f"Match {match_id} has winner_id but no winner object")
                    else:
                        winner_data = {
                            'id': match.winner.id,
                            'username': match.winner.username
                        }
            except Exception as e:
                logger.warning(f"Error processing winner data for match {match_id}: {str(e)}")

            # Prepare status, default to 'pending' if not set
            status = getattr(match, 'status', 'pending')
            if hasattr(match, 'get_status_display'):
                status = match.get_status_display().lower()

            # Log the data being prepared
            logger.info(
                f"Prepared match state - match_id: {match_id}, "
                f"status: {status}, moves: {len(moves_data)}, "
                f"winner: {winner_data['username'] if winner_data and 'username' in winner_data else 'None'}"
            )

            return {
                'status': status,
                'moves': moves_data,
                'winner': winner_data
            }
        except Exception as e:
            logger.error(f"Unexpected error in _get_match_state_data: {str(e)}",
                        exc_info=logger.isEnabledFor(logging.DEBUG))
            # Return minimal valid state on error
            return {
                'status': 'error',
                'moves': [],
                'winner': None,
                'error': 'Failed to load match data'
            }

    @retry_on_deadlock(max_retries=MAX_RETRIES)
    async def broadcast_match_state(self, max_retries: int = MAX_RETRIES) -> None:
        """Broadcast current match state to all connected clients with retry logic.
        Args:
            max_retries: Maximum number of retry attempts for fetching fresh data
        """
        last_error = None
        logger.info(f"Starting broadcast_match_state for match_id: {getattr(self, 'match_id', 'unknown')}")

        for attempt in range(1, max_retries + 1):
            try:
                logger.info(f"Broadcast attempt {attempt}/{max_retries}")

                # Get fresh match data with retry logic
                if not hasattr(self, 'match') or not self.match:
                    logger.warning("No match found when broadcasting state")
                    last_error = "No match found"
                    await asyncio.sleep(RETRY_DELAY * attempt)
                    continue

                logger.info(f"Fetching fresh match data for match_id: {self.match.id}")

                # Get fresh match data with row lock to prevent race conditions
                self.match = await self.get_match(for_update=True)
                if not self.match:
                    logger.error(f"Match {getattr(self, 'match_id', 'unknown')} not found")
                    last_error = "Match not found"
                    await asyncio.sleep(RETRY_DELAY * attempt)
                    continue

                # Get fresh moves with related player data
                moves = await self.get_match_moves()
                logger.info(f"Retrieved {len(moves)} moves for match {self.match.id}")

                # Get match state data safely
                match_data = await self._get_match_state_data(self.match, moves)
                if not match_data:
                    logger.error("Failed to prepare match state data")
                    last_error = "Invalid match data"
                    await asyncio.sleep(RETRY_DELAY * attempt)
                    continue

                # Prepare the complete message with all required fields
                message = await self._prepare_broadcast_message(match_data)

                # Log the broadcast attempt
                logger.info(
                    f"Broadcasting match state (attempt {attempt}/{max_retries}) - "
                    f"match: {message.get('match_id')}, "
                    f"status: {match_data.get('status')}, "
                    f"moves: {len(match_data.get('moves', []))}"
                )

                # Send the message to the group (this will trigger the match_state method for all clients)
                await self.channel_layer.group_send(
                    self.match_group_name,
                    {
                        'type': 'match_state',
                        'match_id': str(self.match.id),
                        'status': match_data['status'],
                        'moves': match_data.get('moves', []),
                        'winner': match_data.get('winner'),
                        'player1': {
                            'id': str(self.match.player1.id),
                            'username': self.match.player1.username
                        } if self.match.player1 else None,
                        'player2': {
                            'id': str(self.match.player2.id) if self.match.player2 else None,
                            'username': self.match.player2.username if self.match.player2 else None
                        } if hasattr(self.match, 'player2') and self.match.player2 else None,
                        'created_at': self.match.created_at.isoformat() if self.match.created_at else None,
                        'updated_at': self.match.updated_at.isoformat() if self.match.updated_at else None
                    }
                )

                # Also send directly to this client to ensure they get the update
                await self.send(text_data=json.dumps({
                    'type': 'match_state',
                    'match_id': str(self.match.id),
                    'status': match_data['status'],
                    'moves': match_data.get('moves', []),
                    'winner': match_data.get('winner'),
                    'player1': {
                        'id': str(self.match.player1.id),
                        'username': self.match.player1.username
                    } if self.match.player1 else None,
                    'player2': {
                        'id': str(self.match.player2.id) if self.match.player2 else None,
                        'username': self.match.player2.username if self.match.player2 else None
                    } if hasattr(self.match, 'player2') and self.match.player2 else None,
                    'created_at': self.match.created_at.isoformat() if self.match.created_at else None,
                    'updated_at': self.match.updated_at.isoformat() if self.match.updated_at else None
                }))

                return  # Success, exit the retry loop

            except Exception as e:
                last_error = str(e)
                logger.warning(
                    f"Attempt {attempt}/{max_retries} failed to broadcast match state: {last_error}",
                    exc_info=attempt == max_retries  # Only log full traceback on last attempt
                )
                if attempt == max_retries:
                    logger.error(
                        f"Failed to broadcast match state after {max_retries} attempts. "
                        f"Last error: {last_error}",
                        exc_info=True
                    )
                else:
                    # Exponential backoff with jitter
                    delay = min(RETRY_DELAY * (2 ** (attempt - 1)), 1.0)  # Cap at 1 second
                    await asyncio.sleep(delay)

        # If we get here, all retries failed
        logger.error(f"Giving up on broadcasting match state after {max_retries} attempts. Last error: {last_error}")

        # As a last resort, try to send a minimal error state
        try:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'code': 'BROADCAST_FAILED',
                'message': 'Failed to load match state',
                'details': last_error[:200] if last_error else 'Unknown error'
            }))
        except Exception as e:
            logger.error(f"[ERROR] Failed to send error state: {str(e)}")

    async def send_error(self, message):
        """Send error message to the client."""
        await self.send(text_data=json.dumps({
            'type': 'error',
            'message': message
        }))

    # Channel layer message handlers
    async def player_joined(self, event):
        """Handle player_joined message from channel layer."""
        await self.send(text_data=json.dumps({
            'type': 'player_joined',
            'player_id': event['player_id'],
            'username': event['username']
        }))

    async def send_match_completed(self) -> None:
        """Send match completed message to all clients."""
        try:
            # Get fresh match data with related fields
            match = await database_sync_to_async(
                lambda: Match.objects.select_related('player1', 'player2', 'winner').get(id=self.match_id)
            )()
            # Get all moves for this match
            moves = await database_sync_to_async(
                lambda: list(Move.objects.filter(match_id=self.match_id).select_related('player'))
            )()

            # Prepare choices dictionary {username: choice}
            choices = {}
            for move in moves:
                if move.player_id == match.player1_id:
                    choices['player1'] = move.choice
                elif match.player2_id and move.player_id == match.player2_id:
                    choices['player2'] = move.choice

            # Prepare winner info
            winner_info = None
            if match.winner:
                winner_info = {
                    'id': str(match.winner.id),
                    'username': match.winner.username
                }

            # Send match completed event to all clients in the group
            await self.channel_layer.group_send(
                self.match_group_name,
                {
                    'type': 'match_completed',
                    'winner': winner_info,
                    'choices': choices,
                    'is_draw': match.winner is None,
                    'match_id': str(self.match_id)
                }
            )
            logger.info(f"[DEBUG] Sent match_completed event for match {self.match_id}")
        except Exception as e:
            logger.error(f"[ERROR] Error in send_match_completed: {str(e)}", exc_info=True)
            raise

    async def match_completed(self, event: Dict[str, Any]) -> None:
        """Handle match_completed message from channel layer.
        Args:
            event: The event data containing match completion details
        """
        try:
            logger.info(f"[DEBUG] Received match_completed event: {json.dumps(event, default=str)}")

            # Update local match state
            if hasattr(self, 'match') and str(self.match.id) == event.get('match_id'):
                self.match.status = Match.Status.FINISHED
                # Update winner if available
                if event.get('winner'):
                    from django.contrib.auth import get_user_model
                    User = get_user_model()
                    try:
                        self.match.winner = await database_sync_to_async(User.objects.get)(id=event['winner']['id'])
                    except Exception as e:
                        logger.warning(f"[WARN] Failed to update winner from event: {str(e)}")

            # Prepare the response
            response = {
                'type': 'match_completed',
                'winner': event.get('winner'),
                'choices': event.get('choices', {}),
                'is_draw': event.get('is_draw', False),
                'match_id': event.get('match_id')
            }

            # Send the match completed message
            await self.send(text_data=json.dumps(response, default=str, ensure_ascii=False))
            logger.info("[DEBUG] Sent match_completed message to client")
        except Exception as e:
            logger.error(f"[ERROR] Error in match_completed handler: {str(e)}", exc_info=True)
            try:
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'code': 'MATCH_COMPLETED_ERROR',
                    'message': 'Failed to process match completion',
                    'details': str(e)[:200]
                }, ensure_ascii=False))
            except Exception as final_error:
                logger.error(f"[ERROR] Failed to send error state: {str(final_error)}")

    async def match_state(self, event: Dict[str, Any]) -> None:
        """Handle match_state message from channel layer.
        Args:
            event: The event data containing match state
        """
        try:
            # Log the received event for debugging
            logger.info(f"[DEBUG] Received match_state event: {json.dumps(event, default=str)}")

            # Check if we have a valid match in the event
            if 'match_id' not in event:
                logger.warning("Received match_state event without match_id")
                return

            # Update local match state from the event data if we have a match
            if not hasattr(self, 'match') or self.match is None:
                # Try to load the match if we don't have it
                try:
                    self.match = await self.get_match()
                    if not self.match:
                        logger.warning(f"Match {event['match_id']} not found in match_state handler")
                        return
                except Exception as e:
                    logger.error(f"Error loading match in match_state: {str(e)}")
                    return

            # Verify the match ID matches
            if str(self.match.id) != event['match_id']:
                logger.warning(f"Match ID mismatch: expected {self.match.id}, got {event['match_id']}")
                return

            # Update match status if available
                if 'status' in event:
                    self.match.status = event['status']
                # Update winner if available
                if 'winner' in event and event['winner']:
                    from django.contrib.auth import get_user_model
                    User = get_user_model()
                    try:
                        self.match.winner = await database_sync_to_async(User.objects.get)(id=event['winner']['id'])
                    except Exception as e:
                        logger.warning(f"[WARN] Failed to update winner from event: {str(e)}")

            # Prepare the response using event data directly (faster and more reliable)
            response = {
                'type': 'match_state',
                'status': event.get('status', 'pending'),
                'moves': event.get('moves', []),
                'winner': event.get('winner'),
                'player1': event.get('player1'),
                'player2': event.get('player2'),
                'created_at': event.get('created_at'),
                'updated_at': event.get('updated_at')
            }

            # Send message to WebSocket
            await self.send(text_data=json.dumps(response, default=str, ensure_ascii=False))
        except Exception as e:
            logger.error(f"[ERROR] Error in match_state handler: {str(e)}", exc_info=True)
            try:
                await self.send(text_data=json.dumps({
                    'type': 'match_state',
                    'status': event.get('status', 'error'),
                    'moves': event.get('moves', []),
                    'winner': None,
                    'player1': None,
                    'player2': None
                }, default=str, ensure_ascii=False))
            except Exception as final_error:
                logger.error(f"[ERROR] Failed to send error state: {str(final_error)}")
            await asyncio.sleep(0.1)

    async def game_over(self, event: Dict[str, Any]) -> None:
        """Handle legacy game.over message from channel layer.
        Args:
            event: The event data containing game over information
        """
        try:
            # Log the received event for debugging
            logger.info(f"Received game_over event: {json.dumps(event, default=str)}")

            # For backward compatibility, but we should use match_completed
            await self.send(text_data=json.dumps({
                'type': 'game.over',
                'winner': event.get('winner'),
                'match_id': event.get('match_id'),
                'is_draw': event.get('is_draw', False)
            }))
        except Exception as e:
            logger.error(f"Error in game_over handler: {str(e)}", exc_info=True)
            try:
                await self.send(text_data=json.dumps({
                    'type': 'game.over',
                    'error': 'Failed to process game over event',
                    'status': 'error'
                }))
            except Exception as final_error:
                logger.error(
                    f"Failed to send error state to client: {str(final_error)}\n"
                    f"Original error: {str(e)}\n"
                    "This is a critical error as we couldn't notify the client about the match completion failure.",
                    exc_info=logger.isEnabledFor(logging.DEBUG)
                )
