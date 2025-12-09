from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from unittest.mock import patch, MagicMock
from .models import Match, Move, Round
from .models_matchmaking import MatchmakingQueue, BotPlayer
from .services import MatchmakingService, RatingService

User = get_user_model()


class MatchmakingServiceTest(TestCase):
    def setUp(self):
        self.service = MatchmakingService()
        self.player1 = User.objects.create_user(
            username='player1',
            email='player1@example.com',
            password='test123',
            rating=1000
        )
        self.player2 = User.objects.create_user(
            username='player2',
            email='player2@example.com',
            password='test123',
            rating=1050
        )
        self.player3 = User.objects.create_user(
            username='player3',
            email='player3@example.com',
            password='test123',
            rating=1200
        )

    def test_join_queue(self):
        """Test joining matchmaking queue."""
        queue_entry = self.service.join_queue(self.player1)
        
        self.assertEqual(queue_entry.player, self.player1)
        self.assertEqual(queue_entry.status, MatchmakingQueue.Status.WAITING)
        self.assertTrue(queue_entry.allow_bots)

    def test_leave_queue(self):
        """Test leaving matchmaking queue."""
        # Join queue first
        self.service.join_queue(self.player1)
        
        # Leave queue
        count = self.service.leave_queue(self.player1)
        
        self.assertEqual(count, 1)
        
        # Check queue entry is cancelled
        queue_entry = MatchmakingQueue.objects.get(player=self.player1)
        self.assertEqual(queue_entry.status, MatchmakingQueue.Status.CANCELLED)

    def test_player_matching(self):
        """Test matching two players with similar ratings."""
        # Both players join queue
        self.service.join_queue(self.player1)
        self.service.join_queue(self.player2)
        
        # Process queue
        self.service.process_queue()
        
        # Check match was created
        match = Match.objects.filter(
            player1=self.player1,
            player2=self.player2,
            status=Match.Status.ACTIVE
        ).first()
        
        self.assertIsNotNone(match)
        
        # Check queue entries are marked as matched
        queue_entry1 = MatchmakingQueue.objects.get(player=self.player1)
        queue_entry2 = MatchmakingQueue.objects.get(player=self.player2)
        
        self.assertEqual(queue_entry1.status, MatchmakingQueue.Status.MATCHED)
        self.assertEqual(queue_entry2.status, MatchmakingQueue.Status.MATCHED)

    def test_rating_difference_filtering(self):
        """Test that players with large rating differences don't get matched."""
        # Players with large rating difference join queue
        self.service.join_queue(self.player1)  # 1000 rating
        self.service.join_queue(self.player3)  # 1200 rating (200 difference)
        
        # Process queue
        self.service.process_queue()
        
        # No match should be created due to rating difference
        match = Match.objects.filter(
            player1=self.player1,
            player2=self.player3
        ).first()
        
        self.assertIsNone(match)

    def test_bot_matching(self):
        """Test matching with bot when no human opponent available."""
        # Player joins queue allowing bots
        self.service.join_queue(self.player1, allow_bots=True)
        
        # Process queue
        self.service.process_queue()
        
        # Check match was created with bot
        match = Match.objects.filter(
            player1=self.player1,
            player2__is_bot=True,
            status=Match.Status.ACTIVE
        ).first()
        
        self.assertIsNotNone(match)
        
        # Check bot was created
        bot_user = match.player2
        self.assertTrue(bot_user.is_bot)
        self.assertEqual(bot_user.bot_difficulty, 'medium')

    def test_queue_preferences(self):
        """Test matchmaking preferences are respected."""
        # Player joins queue with specific preferences
        self.service.join_queue(
            self.player1,
            preferred_difficulty='hard',
            allow_bots=True
        )
        
        # Process queue
        self.service.process_queue()
        
        # Check bot was created with preferred difficulty
        match = Match.objects.filter(
            player1=self.player1,
            player2__is_bot=True
        ).first()
        
        self.assertIsNotNone(match)
        self.assertEqual(match.player2.bot_difficulty, 'hard')


class BotPlayerTest(TestCase):
    def setUp(self):
        self.bot_user = User.objects.create_user(
            username='bot_test',
            email='bot@example.com',
            password='bot123',
            is_bot=True,
            bot_difficulty='medium'
        )
        self.bot = BotPlayer.objects.create(
            user=self.bot_user,
            difficulty='medium',
            strategy='random'
        )

    def test_random_strategy(self):
        """Test bot random move selection."""
        self.bot.strategy = BotPlayer.Strategy.RANDOM
        
        # Test multiple moves
        moves = []
        for _ in range(100):
            move = self.bot.get_move_choice()
            self.assertIn(move, ['rock', 'paper', 'scissors'])
            moves.append(move)
        
        # Should have some variety
        unique_moves = set(moves)
        self.assertGreater(len(unique_moves), 1)

    def test_counter_strategy(self):
        """Test bot counter strategy."""
        self.bot.strategy = BotPlayer.Strategy.COUNTER
        
        # Test with opponent history
        opponent_history = ['rock', 'rock', 'paper', 'rock']
        move = self.bot.get_move_choice(opponent_history)
        
        # Should counter most frequent move (rock)
        self.assertEqual(move, 'paper')

    def test_pattern_strategy(self):
        """Test bot pattern detection strategy."""
        self.bot.strategy = BotPlayer.Strategy.PATTERN
        
        # Test with pattern
        opponent_history = ['rock', 'paper', 'rock', 'paper']
        move = self.bot.get_move_choice(opponent_history)
        
        # Should predict and counter next move in pattern
        self.assertEqual(move, 'scissors')

    def test_adaptive_strategy(self):
        """Test bot adaptive strategy."""
        self.bot.strategy = BotPlayer.Strategy.ADAPTIVE
        self.bot.difficulty = 'hard'
        
        # Test with some history
        opponent_history = ['rock', 'paper', 'scissors']
        move = self.bot.get_move_choice(opponent_history)
        
        # Should return a valid move
        self.assertIn(move, ['rock', 'paper', 'scissors'])

    def test_response_time_range(self):
        """Test bot response time configuration."""
        self.bot.response_time_range = {'min': 1.5, 'max': 4.0}
        self.bot.save()
        
        # Test response time is within range
        import random
        for _ in range(10):
            delay = random.uniform(
                self.bot.response_time_range['min'],
                self.bot.response_time_range['max']
            )
            self.assertGreaterEqual(delay, 1.5)
            self.assertLessEqual(delay, 4.0)


class RatingServiceTest(TestCase):
    def setUp(self):
        self.player1 = User.objects.create_user(
            username='player1',
            rating=1000
        )
        self.player2 = User.objects.create_user(
            username='player2',
            rating=1000
        )

    def test_elo_calculation_equal_ratings(self):
        """Test ELO calculation with equal ratings."""
        new_rating1, new_rating2 = RatingService.calculate_new_ratings(
            1000, 1000, 'player1'
        )
        
        # Winner should gain ~16 points, loser should lose ~16 points
        self.assertEqual(new_rating1, 1016)
        self.assertEqual(new_rating2, 984)

    def test_elo_calculation_higher_rated_wins(self):
        """Test ELO calculation when higher rated player wins."""
        new_rating1, new_rating2 = RatingService.calculate_new_ratings(
            1200, 1000, 'player1'
        )
        
        # Higher rated player should gain fewer points
        self.assertEqual(new_rating1, 1208)
        self.assertEqual(new_rating2, 992)

    def test_elo_calculation_upset_win(self):
        """Test ELO calculation when lower rated player wins."""
        new_rating1, new_rating2 = RatingService.calculate_new_ratings(
            1000, 1200, 'player2'
        )
        
        # Lower rated player should gain more points for upset
        self.assertEqual(new_rating1, 992)
        self.assertEqual(new_rating2, 1208)

    def test_elo_calculation_draw(self):
        """Test ELO calculation for draw."""
        new_rating1, new_rating2 = RatingService.calculate_new_ratings(
            1000, 1000, 'draw'
        )
        
        # Ratings should move slightly towards each other
        self.assertEqual(new_rating1, 1008)
        self.assertEqual(new_rating2, 1008)

    def test_update_match_ratings(self):
        """Test updating ratings after match completion."""
        # Create match
        match = Match.objects.create(
            player1=self.player1,
            player2=self.player2,
            status=Match.Status.FINISHED,
            winner=self.player1
        )
        
        # Update ratings
        RatingService.update_match_ratings(match)
        
        # Check ratings were updated
        self.player1.refresh_from_db()
        self.player2.refresh_from_db()
        
        self.assertEqual(self.player1.rating, 1016)
        self.assertEqual(self.player2.rating, 984)


class MatchmakingIntegrationTest(TestCase):
    def setUp(self):
        self.service = MatchmakingService()
        
        # Create multiple players with different ratings
        self.players = []
        for i, rating in enumerate([800, 900, 1000, 1100, 1200]):
            player = User.objects.create_user(
                username=f'player{i}',
                email=f'player{i}@example.com',
                password='test123',
                rating=rating
            )
            self.players.append(player)

    @patch('game.services.async_to_sync')
    def test_full_matchmaking_cycle(self, mock_async):
        """Test full matchmaking cycle with multiple players."""
        # Mock WebSocket notifications
        mock_async.return_value = MagicMock()
        
        # All players join queue
        for player in self.players:
            self.service.join_queue(player)
        
        # Process queue
        self.service.process_queue()
        
        # Check matches were created
        matches = Match.objects.filter(status=Match.Status.ACTIVE)
        self.assertEqual(matches.count(), 2)  # 2 matches, 1 player left
        
        # Check queue entries are processed
        waiting_entries = MatchmakingQueue.objects.filter(
            status=MatchmakingQueue.Status.WAITING
        )
        self.assertEqual(waiting_entries.count(), 1)  # 1 player still waiting

    def test_priority_matching(self):
        """Test that players who waited longer get priority."""
        # First player joins queue
        self.service.join_queue(self.players[0])
        
        # Simulate waiting time
        queue_entry = MatchmakingQueue.objects.get(player=self.players[0])
        queue_entry.created_at = timezone.now() - timezone.timedelta(minutes=5)
        queue_entry.save()
        
        # Second player joins queue
        self.service.join_queue(self.players[1])
        
        # Process queue
        self.service.process_queue()
        
        # Check match was created
        match = Match.objects.filter(
            player1=self.players[0],
            player2=self.players[1]
        ).first()
        
        self.assertIsNotNone(match)
