from django.db import transaction
from django.db.models import F
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
try:
    from rest_framework_simplejwt.tokens import AccessToken
except ImportError:
    # Fallback for when Django isn't loaded yet
    AccessToken = None
try:
    from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
except ImportError:
    # Fallback for when Django isn't loaded yet
    TokenError = Exception
    InvalidToken = Exception
from .models import Match, Move, Round

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
    """
    WebSocket consumer for handling real-time match communication.
    """
    
    async def connect(self):
        """Handle WebSocket connection."""
        self.match_id = self.scope['url_route']['kwargs']['match_id']
        self.match_group_name = f'match_{self.match_id}'
        
        print(f"[WebSocket] Connection attempt to match {self.match_id}")
        
        # Get user from scope (set by JWTAuthMiddleware)
        self.user = self.scope.get('user')
        
        print(f"[WebSocket] User: {self.user}, authenticated: {self.user.is_authenticated if self.user else 'No user'}")
        
        if not self.user or not self.user.is_authenticated:
            print("[WebSocket] Rejecting connection - user not authenticated")
            await self.close(code=4001)
            return
        
        # Join match group
        await self.channel_layer.group_add(
            self.match_group_name,
            self.channel_name
        )
        
        await self.accept()
        
        # Send initial match state to the connecting client
        await self.send_match_state()

        # Broadcast latest state to the rest of the group so opponents update immediately
        try:
            state = await self.build_match_state()
            if state:
                await self.channel_layer.group_send(
                    self.match_group_name,
                    {
                        'type': 'match_state',
                        **{k: v for k, v in state.items() if k != 'type'}
                    }
                )
        except Exception as e:
            logger.error(f"Error broadcasting match state on connect: {e}", exc_info=True)
        
        logger.info(f"User {self.user.id} connected to match {self.match_id}")
    
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        if hasattr(self, 'match_group_name'):
            await self.channel_layer.group_discard(
                self.match_group_name,
                self.channel_name
            )
        
        logger.info(f"User disconnected from match {self.match_id} with code {close_code}")
    
    async def receive(self, text_data):
        """Handle incoming WebSocket messages."""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'join_match':
                await self.handle_join_match(data)
            elif message_type == 'start_game':
                await self.handle_start_game(data)
            elif message_type == 'move':
                await self.handle_move(data)
            elif message_type == 'sync_request':
                await self.handle_sync_request(data)
            elif message_type == 'ping':
                # Respond to ping with pong to keep connection alive
                await self.send(text_data=json.dumps({'type': 'pong'}))
            else:
                await self.send_error(f"Unknown message type: {message_type}")
                
        except json.JSONDecodeError:
            await self.send_error("Invalid JSON format")
        except Exception as e:
            logger.error(f"Error processing message: {e}", exc_info=True)
            await self.send_error("Internal server error")
    
    async def handle_join_match(self, data):
        """Handle player joining match."""
        try:
            match = await self.get_match()
            
            if not match:
                await self.send_error("Match not found")
                return
            
            # Notify other players
            await self.channel_layer.group_send(
                self.match_group_name,
                {
                    'type': 'player_joined',
                    'username': self.user.username,
                    'player_id': self.user.id
                }
            )
            
            # Send updated match state
            await self.send_match_state()
            
        except Exception as e:
            logger.error(f"Error in handle_join_match: {e}", exc_info=True)
            await self.send_error("Failed to join match")
    
    async def handle_start_game(self, data):
        """Handle game start request."""
        try:
            match = await self.get_match()
            
            if not match:
                await self.send_error("Match not found")
                return
            
            # Update match status to active
            await self.update_match_status('active')
            
            # Notify all players
            await self.channel_layer.group_send(
                self.match_group_name,
                {
                    'type': 'match_state',
                    'status': 'active',
                    'players': [
                        {'id': match.player1.id, 'username': match.player1.username},
                        {'id': match.player2.id, 'username': match.player2.username} if match.player2 else None
                    ] if match.player2 else [
                        {'id': match.player1.id, 'username': match.player1.username}
                    ]
                }
            )
            
        except Exception as e:
            logger.error(f"Error in handle_start_game: {e}", exc_info=True)
            await self.send_error("Failed to start game")
    
    async def handle_move(self, data):
        """Handle player move."""
        try:
            choice = data.get('choice')
            
            if choice not in ['rock', 'paper', 'scissors']:
                await self.send_error("Invalid move choice")
                return
            
            match = await self.get_match()
            
            if not match or match.status != 'active':
                await self.send_error("Game is not in progress")
                return
            
            # Create move record
            await self.create_move(choice)
            
            # Broadcast move made
            await self.channel_layer.group_send(
                self.match_group_name,
                {
                    'type': 'move_made',
                    'player_id': self.user.id,
                    'choice': choice
                }
            )
            
            # Check if round is complete
            await self.check_round_complete(match)
            
            # Check if bot should move
            await self.schedule_bot_move(match)
            
            # Send updated match state
            await self.send_match_state()
            
        except ValidationError as e:
            # Handle validation errors specifically
            error_message = str(e)
            if error_message.startswith('[') and error_message.endswith(']'):
                # Extract message from ValidationError format
                error_message = error_message[1:-1]
            await self.send_error(error_message)
        except Exception as e:
            logger.error(f"Error in handle_move: {e}", exc_info=True)
            await self.send_error("Failed to make move")
    
    async def handle_sync_request(self, data):
        """Handle synchronization request from client."""
        try:
            match = await self.get_match()
            
            if not match:
                await self.send_error("Match not found")
                return
            
            print(f"[WebSocket] Sync request for match {match.id} from user {self.user.id}")
            
            # Send comprehensive state response
            await self.send_full_state(match)
            
        except Exception as e:
            logger.error(f"Error in handle_sync_request: {e}", exc_info=True)
            await self.send_error("Failed to sync state")
    
    async def send_full_state(self, match):
        """Send complete match state for synchronization."""
        try:
            print(f"[WebSocket] Sending full state for match {match.id}")

            # Reuse the synchronous builder so all ORM access is safe
            base_state = await self.build_match_state()
            if not base_state:
                await self.send_error("Match not found")
                return

            current_round = await self.get_current_round_info(match)
            opponent = await self.get_opponent_info(match)
            timer_info = await self.get_timer_info(match)

            normalized_moves = [
                {
                    'playerId': move.get('player_id'),
                    'choice': move.get('choice'),
                    'timestamp': move.get('created_at'),
                }
                for move in base_state.get('moves', [])
            ]

            payload = {
                'type': 'state',
                'status': base_state.get('status'),
                'moves': normalized_moves,
                'opponent': opponent,
                'timer': timer_info,
                'current_round': current_round,
                'wins_needed': base_state.get('wins_needed'),
                'winner': base_state.get('winner'),
                'created_at': base_state.get('created_at'),
                'updated_at': base_state.get('updated_at'),
            }

            print(f"[WebSocket] Full state: {payload}")
            await self.send(text_data=json.dumps(payload))

        except Exception as e:
            logger.error(f"Error sending full state: {e}", exc_info=True)
            await self.send_error("Failed to send state")
    
    async def get_current_round_info(self, match):
        """Get current round information."""
        try:
            moves = list(match.moves.all())
            
            # Check if we have an incomplete round (odd number of moves)
            if len(moves) % 2 == 1:
                last_move = moves[-1]
                return {
                    'round_number': (len(moves) + 1) // 2,
                    'current_move': {
                        'playerId': last_move.player.id,
                        'choice': last_move.choice,
                        'timestamp': last_move.timestamp.isoformat()
                    },
                    'is_complete': False
                }
            else:
                # Last completed round
                if moves:
                    round_number = len(moves) // 2
                    return {
                        'round_number': round_number,
                        'is_complete': True
                    }
                else:
                    return {
                        'round_number': 1,
                        'is_complete': False
                    }
                    
        except Exception as e:
            logger.error(f"Error getting current round info: {e}")
            return None
    
    async def get_opponent_info(self, match):
        """Get opponent information."""
        try:
            # Determine opponent based on current user
            if match.player1.id == self.user.id:
                opponent = match.player2
            else:
                opponent = match.player1
            
            if opponent:
                return {
                    'id': opponent.id,
                    'username': opponent.username,
                    'is_online': True  # Could be enhanced with actual online status
                }
            else:
                return None
                
        except Exception as e:
            logger.error(f"Error getting opponent info: {e}")
            return None
    
    async def get_timer_info(self, match):
        """Get timer/countdown information."""
        try:
            # For now, return basic timer info
            # This could be enhanced with actual countdown logic
            return {
                'countdown': 30,  # Default countdown
                'is_active': match.status == 'active'
            }
        except Exception as e:
            logger.error(f"Error getting timer info: {e}")
            return None
    
    @database_sync_to_async
    def build_match_state(self):
        """Build match state dictionary in a synchronous context for safe ORM access."""
        from .serializers import RoundSerializer

        try:
            match = (
                Match.objects
                .select_related('player1', 'player2', 'winner')
                .prefetch_related('moves__player', 'rounds__move1__player', 'rounds__move2__player')
                .get(id=self.match_id)
            )
        except Match.DoesNotExist:
            return None

        players = []
        if match.player2:
            players = [
                {'id': match.player1.id, 'username': match.player1.username},
                {'id': match.player2.id, 'username': match.player2.username},
            ]
        else:
            players = [
                {'id': match.player1.id, 'username': match.player1.username},
            ]

        moves = [
            {
                'player_id': m.player.id,
                'choice': m.choice,
                'created_at': m.timestamp.isoformat(),
            }
            for m in sorted(match.moves.all(), key=lambda x: x.timestamp)
        ]

        rounds_qs = match.rounds.all().order_by('round_number')
        rounds_data = RoundSerializer(rounds_qs, many=True).data

        return {
            'type': 'match_state',
            'id': match.id,
            'status': match.status,
            'wins_needed': match.wins_needed,
            'players': players,
            'moves': moves,
            'rounds': rounds_data,
            'winner': match.winner_id,
            'created_at': match.created_at.isoformat(),
            'updated_at': match.updated_at.isoformat(),
        }

    async def send_match_state(self):
        """Send current match state to client."""
        try:
            state = await self.build_match_state()

            if not state:
                await self.send_error("Match not found")
                return

            print(f"[WebSocket] Sending match state for match {state['id']}, status: {state['status']}")
            print(f"[WebSocket] Sending state: {state}")
            await self.send(text_data=json.dumps(state))

        except Exception as e:
            import traceback
            print(f"[WebSocket] Exception in send_match_state: {e}")
            print(f"[WebSocket] Traceback: {traceback.format_exc()}")
            logger.error(f"Error sending match state: {e}", exc_info=True)
            await self.send_error("Failed to get match state")
    
    async def send_error(self, message):
        """Send error message to client."""
        await self.send(text_data=json.dumps({
            'type': 'error',
            'error': message
        }))
    
    async def player_joined(self, event):
        """Handle player joined notification."""
        await self.send(text_data=json.dumps({
            'type': 'player_joined',
            'username': event['username'],
            'player_id': event['player_id']
        }))
    
    async def match_state(self, event):
        """Handle match state update."""
        await self.send(text_data=json.dumps(event))
    
    async def move_made(self, event):
        """Handle move made notification."""
        await self.send(text_data=json.dumps(event))
    
    async def round_complete(self, event):
        """Handle round completion notification."""
        await self.send(text_data=json.dumps(event))
    
    @database_sync_to_async
    def get_match(self):
        """Get match from database."""
        try:
            return Match.objects.select_related('player1', 'player2').prefetch_related('moves__player').get(id=self.match_id)
        except Match.DoesNotExist:
            return None
    
    @database_sync_to_async
    def update_match_status(self, status):
        """Update match status with retry on deadlock."""
        from django.db import transaction
        
        def _update():
            with transaction.atomic():
                match = Match.objects.select_for_update().get(id=self.match_id)
                match.status = status
                match.save()
        
        return _update()
    
    @database_sync_to_async
    def create_move(self, choice, player=None):
        """Создание хода с блокировкой для предотвращения гонок.

        Позволяет передать конкретного игрока (например, бота). Если player не
        указан, используется self.user.
        """
        player = player or self.user

        def _create():
            with transaction.atomic():
                # Блокируем запись матча
                match = Match.objects.select_for_update().get(id=self.match_id)
                
                # Получаем текущий раунд, где move2=None
                current_round = match.rounds.filter(move2__isnull=True).order_by('round_number').first()
                
                if current_round:
                    # Проверяем, не сделал ли уже игрок ход в этом раунде
                    if (current_round.move1 and current_round.move1.player_id == player.id) or \
                       (current_round.move2 and current_round.move2.player_id == player.id):
                        raise ValidationError("Вы уже сделали ход в этом раунде")
                    
                    # Создаем ход
                    move = Move.objects.create(
                        match=match,
                        player=player,
                        choice=choice
                    )
                    
                    # Обновляем раунд
                    if not current_round.move1:
                        current_round.move1 = move
                        current_round.save(update_fields=['move1'])
                        return False  # Раунд еще не завершен
                    else:
                        current_round.move2 = move
                        current_round.save(update_fields=['move2'])
                        return True  # Раунд завершен
                else:
                    # Создаем новый раунд
                    round_number = match.rounds.count() + 1
                    move = Move.objects.create(
                        match=match,
                        player=player,
                        choice=choice
                    )
                    Round.objects.create(
                        match=match,
                        round_number=round_number,
                        move1=move
                    )
                    return False  # Раунд только начат
        
        return _create()
        
    @database_sync_to_async
    def get_rounds_data(self, match):
        """Get serialized rounds data."""
        from .serializers import RoundSerializer
        rounds = match.rounds.all().order_by('round_number')
        return RoundSerializer(rounds, many=True).data
    
    async def check_round_complete(self, match=None):
        """Check if round is complete and determine winner.

        If a match instance is provided, use it; otherwise, fetch via get_match().
        """
        try:
            if match is None:
                match = await self.get_match()
            
            if not match:
                return
            
            # Find the latest round for this match
            last_round = await database_sync_to_async(
                lambda: match.rounds.select_related('move1__player', 'move2__player', 'winner')
                .order_by('-round_number')
                .first()
            )()

            # We need a round with both moves present
            if not last_round or not last_round.move1 or not last_round.move2:
                return

            # If result already recorded, nothing to do
            if last_round.winner or last_round.is_draw:
                return

            move1 = last_round.move1
            move2 = last_round.move2
            round_number = last_round.round_number

            # Determine round winner
            winner_result = self.determine_winner(move1.choice, move2.choice)

            def _update_round():
                # Use an explicit transaction so select_for_update is valid
                with transaction.atomic():
                    r = Round.objects.select_for_update().get(pk=last_round.pk)
                    if winner_result == 'draw':
                        r.winner = None
                        r.is_draw = True
                    else:
                        r.winner = move1.player if winner_result == 'player1' else move2.player
                        r.is_draw = False
                    r.save(update_fields=['winner', 'is_draw'])
                    return r

            round_obj = await database_sync_to_async(_update_round)()

            # Refresh match state from DB for win calculations
            match = await self.get_match()

            # Evaluate match completion and winner inside sync context to avoid SynchronousOnlyOperation
            def _check_match(m):
                is_complete = m.is_match_complete()
                winner = m.get_match_winner() if is_complete else None
                return is_complete, winner

            is_complete, match_winner = await database_sync_to_async(_check_match)(match)

            if is_complete:
                if match_winner:
                    match.winner = match_winner
                    await database_sync_to_async(match.save)(update_fields=['winner'])
                await self.update_match_status('finished')

                # Build full match state and broadcast to all players
                state = await self.build_match_state()
                if not state:
                    return

                await self.channel_layer.group_send(
                    self.match_group_name,
                    {
                        'type': 'match_state',
                        **{k: v for k, v in state.items() if k != 'type'}
                    }
                )
            else:
                # Notify of round completion
                await self.channel_layer.group_send(
                    self.match_group_name,
                    {
                        'type': 'round_complete',
                        'round_number': round_number,
                        'winner': {
                            'id': round_obj.winner.id,
                            'username': round_obj.winner.username
                        } if round_obj.winner else None,
                        'is_draw': round_obj.is_draw,
                        'rounds': await self.get_rounds_data(match)
                    }
                )
                
        except Exception as e:
            logger.error(f"Error checking round complete: {e}", exc_info=True)
    
    def determine_winner(self, choice1, choice2):
        """Determine winner of rock-paper-scissors round."""
        if choice1 == choice2:
            return 'draw'
        
        wins = {
            ('rock', 'scissors'): 'player1',
            ('scissors', 'paper'): 'player1',
            ('paper', 'rock'): 'player1',
            ('scissors', 'rock'): 'player2',
            ('paper', 'scissors'): 'player2',
            ('rock', 'paper'): 'player2'
        }
        
        return wins.get((choice1, choice2), 'draw')
    
    async def handle_bot_move(self, match):
        """Handle bot player moves automatically."""
        try:
            from .models_matchmaking import BotPlayer
            
            # Check if any player is a bot
            bot_player = None
            human_player = None
            
            if match.player1.is_bot:
                bot_player = match.player1
                human_player = match.player2
            elif match.player2 and match.player2.is_bot:
                bot_player = match.player2
                human_player = match.player1
            
            if not bot_player:
                return
            
            # Get bot profile
            try:
                bot_profile = await database_sync_to_async(BotPlayer.objects.get)(user=bot_player)
            except BotPlayer.DoesNotExist:
                logger.warning(f"Bot profile not found for {bot_player.username}")
                return
            
            # Get opponent's move history
            opponent_moves = await database_sync_to_async(list)(
                Move.objects.filter(
                    match=match,
                    player=human_player
                ).order_by('timestamp').values_list('choice', flat=True)
            )
            
            # Get bot's move choice
            bot_choice = await database_sync_to_async(bot_profile.get_move_choice)(opponent_moves)
            
            # Create bot move using shared helper so round state stays consistent
            try:
                await self.create_move(bot_choice, player=bot_player)
            except ValidationError as ve:
                logger.warning(f"Bot {bot_player.username} move skipped: {ve}")
                return
            
            logger.info(f"Bot {bot_player.username} played {bot_choice}")

            # Broadcast move just like a human move so clients stay in sync
            await self.channel_layer.group_send(
                self.match_group_name,
                {
                    'type': 'move_made',
                    'player_id': bot_player.id,
                    'choice': bot_choice
                }
            )
            
            # Check if round is complete
            await self.check_round_complete(match)
            
        except Exception as e:
            logger.error(f"Error handling bot move: {e}", exc_info=True)
    
    async def schedule_bot_move(self, match):
        """Schedule a bot move with realistic timing."""
        try:
            from .models_matchmaking import BotPlayer
            
            # Get bot profile
            bot_player = match.player1 if match.player1.is_bot else match.player2
            if not bot_player or not bot_player.is_bot:
                return
            
            bot_profile = await database_sync_to_async(BotPlayer.objects.get)(user=bot_player)
            
            # Get response time range
            response_time = bot_profile.response_time_range or {'min': 1.0, 'max': 3.0}
            
            import random
            delay = random.uniform(response_time['min'], response_time['max'])
            
            logger.info(f"Scheduling bot move in {delay:.1f} seconds")
            
            # Schedule bot move
            await asyncio.sleep(delay)
            await self.handle_bot_move(match)
            
        except Exception as e:
            logger.error(f"Error scheduling bot move: {e}", exc_info=True)
