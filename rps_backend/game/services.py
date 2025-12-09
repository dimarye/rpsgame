import logging
import asyncio
from datetime import datetime, timedelta
from django.utils import timezone
from django.db import transaction
from django.contrib.auth import get_user_model
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import Match, Round, Move
from .models_matchmaking import MatchmakingQueue, BotPlayer

logger = logging.getLogger(__name__)
User = get_user_model()

class MatchmakingService:
    """Service for handling matchmaking logic."""
    
    def __init__(self):
        self.channel_layer = get_channel_layer()
    
    def join_queue(self, player, preferred_difficulty='any', allow_bots=True):
        """Add a player to the matchmaking queue."""
        # Remove any existing queue entries for this player
        MatchmakingQueue.objects.filter(
            player=player, 
            status=MatchmakingQueue.Status.WAITING
        ).delete()
        
        # Create new queue entry
        queue_entry = MatchmakingQueue.objects.create(
            player=player,
            preferred_difficulty=preferred_difficulty,
            allow_bots=allow_bots
        )
        
        logger.info(f'Player {player.username} joined matchmaking queue')
        
        # Try to find a match immediately
        self.process_queue()
        
        return queue_entry
    
    def leave_queue(self, player):
        """Remove a player from the matchmaking queue."""
        queue_entries = MatchmakingQueue.objects.filter(
            player=player,
            status=MatchmakingQueue.Status.WAITING
        )
        
        count = queue_entries.count()
        queue_entries.update(status=MatchmakingQueue.Status.CANCELLED)
        
        logger.info(f'Player {player.username} left matchmaking queue ({count} entries removed)')
        return count
    
    def process_queue(self):
        """Process the matchmaking queue to create matches."""
        waiting_players = MatchmakingQueue.objects.filter(
            status=MatchmakingQueue.Status.WAITING
        ).order_by('created_at')
        
        if len(waiting_players) < 2:
            # Try to match with bots if only one player waiting
            if waiting_players and waiting_players[0].allow_bots:
                self._match_with_bot(waiting_players[0])
            return
        
        # Match players with similar ratings
        matched_pairs = self._find_player_matches(waiting_players)
        
        for player1_entry, player2_entry in matched_pairs:
            self._create_match(player1_entry, player2_entry)
        
        # Handle remaining players with bots
        remaining = [entry for entry in waiting_players if not any(
            entry in pair for pair in matched_pairs
        )]
        
        for entry in remaining:
            if entry.allow_bots:
                self._match_with_bot(entry)
    
    def _find_player_matches(self, waiting_players):
        """Find optimal player matches based on rating."""
        matches = []
        used_players = set()
        
        for i, player1_entry in enumerate(waiting_players):
            if player1_entry.player.id in used_players:
                continue
                
            for player2_entry in waiting_players[i+1:]:
                if player2_entry.player.id in used_players:
                    continue
                
                # Check rating compatibility (within 200 points)
                rating_diff = abs(
                    player1_entry.player.rating - player2_entry.player.rating
                )
                
                if rating_diff <= 200:
                    matches.append((player1_entry, player2_entry))
                    used_players.add(player1_entry.player.id)
                    used_players.add(player2_entry.player.id)
                    break
        
        return matches
    
    def _match_with_bot(self, player_entry):
        """Match a player with a bot."""
        try:
            # Find or create a suitable bot
            bot = self._get_suitable_bot(player_entry)
            
            # Create match
            match = self._create_match_with_bot(player_entry, bot)
            
            # Update queue entry
            player_entry.mark_as_matched(match)
            
            # Notify player
            self._notify_player_match(player_entry.player, match)
            
            logger.info(f'Player {player_entry.player.username} matched with bot {bot.user.username}')
            
        except Exception as e:
            logger.error(f'Failed to match player {player_entry.player.username} with bot: {e}')
    
    def _get_suitable_bot(self, player_entry):
        """Get a suitable bot for the player."""
        preferred_difficulty = player_entry.preferred_difficulty
        
        # Try to find existing bot
        bot_query = BotPlayer.objects.filter(
            is_active=True,
            difficulty=preferred_difficulty if preferred_difficulty != 'any' else 'medium'
        )
        
        if bot_query.exists():
            return bot_query.first()
        
        # Create new bot
        difficulty = preferred_difficulty if preferred_difficulty != 'any' else 'medium'
        bot_user = User.objects.create_user(
            username=f'bot_{difficulty}_{timezone.now().timestamp()}',
            email=f'bot_{difficulty}@example.com',
            password='bot_password_123',
            is_bot=True,
            bot_difficulty=difficulty,
            rating=self._get_bot_rating(difficulty)
        )
        
        bot = BotPlayer.objects.create(
            user=bot_user,
            difficulty=difficulty,
            response_time_range={'min': 1.0, 'max': 3.0}
        )
        
        return bot
    
    def _get_bot_rating(self, difficulty):
        """Get appropriate rating for bot difficulty."""
        ratings = {
            'easy': 800,
            'medium': 1000,
            'hard': 1200
        }
        return ratings.get(difficulty, 1000)
    
    def _create_match_with_bot(self, player_entry, bot):
        """Create a match between player and bot."""
        with transaction.atomic():
            match = Match.objects.create(
                player1=player_entry.player,
                player2=bot.user,
                status=Match.Status.ACTIVE
            )
            
            # Notify via WebSocket
            self._notify_match_created(match)
            
            return match
    
    def _create_match(self, player1_entry, player2_entry):
        """Create a match between two players."""
        with transaction.atomic():
            match = Match.objects.create(
                player1=player1_entry.player,
                player2=player2_entry.player,
                status=Match.Status.ACTIVE
            )
            
            # Update queue entries
            player1_entry.mark_as_matched(match)
            player2_entry.mark_as_matched(match)
            
            # Notify players
            self._notify_player_match(player1_entry.player, match)
            self._notify_player_match(player2_entry.player, match)
            
            # Notify via WebSocket
            self._notify_match_created(match)
            
            logger.info(f'Created match between {player1_entry.player.username} and {player2_entry.player.username}')
            
            return match
    
    def _notify_player_match(self, player, match):
        """Send notification to player about match."""
        try:
            # Send WebSocket notification
            async_to_sync(self.channel_layer.group_send)(
                f'user_{player.id}',
                {
                    'type': 'match_found',
                    'data': {
                        'match_id': match.id,
                        'player1': match.player1.username,
                        'player2': match.player2.username if match.player2 else None,
                        'status': match.status
                    }
                }
            )
        except Exception as e:
            logger.error(f'Failed to notify player {player.username}: {e}')
    
    def _notify_match_created(self, match):
        """Notify all players in match about game start."""
        try:
            # Send to match group
            async_to_sync(self.channel_layer.group_send)(
                f'match_{match.id}',
                {
                    'type': 'game_start',
                    'data': {
                        'match_id': match.id,
                        'player1': {
                            'id': match.player1.id,
                            'username': match.player1.username,
                            'rating': match.player1.rating
                        },
                        'player2': {
                            'id': match.player2.id,
                            'username': match.player2.username,
                            'rating': match.player2.rating
                        } if match.player2 else None,
                        'status': match.status
                    }
                }
            )
        except Exception as e:
            logger.error(f'Failed to notify match {match.id}: {e}')


class RatingService:
    """Service for handling ELO rating calculations."""
    
    K_FACTOR = 32  # Standard ELO K-factor
    
    @classmethod
    def calculate_new_ratings(cls, player1_rating, player2_rating, winner):
        """Calculate new ELO ratings after a match."""
        # Expected scores
        expected1 = cls._expected_score(player1_rating, player2_rating)
        expected2 = cls._expected_score(player2_rating, player1_rating)
        
        # Actual scores
        if winner == 'player1':
            actual1 = 1.0
            actual2 = 0.0
        elif winner == 'player2':
            actual1 = 0.0
            actual2 = 1.0
        else:  # draw
            actual1 = 0.5
            actual2 = 0.5
        
        # Calculate new ratings
        new_rating1 = player1_rating + cls.K_FACTOR * (actual1 - expected1)
        new_rating2 = player2_rating + cls.K_FACTOR * (actual2 - expected2)
        
        return int(round(new_rating1)), int(round(new_rating2))
    
    @classmethod
    def _expected_score(cls, rating1, rating2):
        """Calculate expected score for player with rating1 against rating2."""
        return 1.0 / (1.0 + 10 ** ((rating2 - rating1) / 400))
    
    @classmethod
    def update_match_ratings(cls, match):
        """Update player ratings after match completion."""
        if match.status != Match.Status.FINISHED or not match.winner:
            return
        
        player1_old = match.player1.rating
        player2_old = match.player2.rating if match.player2 else 1000
        
        # Determine winner
        if match.winner == match.player1:
            winner = 'player1'
        elif match.winner == match.player2:
            winner = 'player2'
        else:
            winner = 'draw'  # Shouldn't happen with current logic
        
        # Calculate new ratings
        new_rating1, new_rating2 = cls.calculate_new_ratings(
            player1_old, player2_old, winner
        )
        
        # Update ratings
        match.player1.rating = new_rating1
        match.player1.save()
        
        if match.player2:
            match.player2.rating = new_rating2
            match.player2.save()
        
        logger.info(f'Updated ratings: {match.player1.username} {player1_old}->{new_rating1}, '
                   f'{match.player2.username if match.player2 else "Bot"} {player2_old}->{new_rating2}')


# Global service instances
matchmaking_service = MatchmakingService()
rating_service = RatingService()
