import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model
from game.models import Match, Move
from game.models_matchmaking import MatchmakingQueue, BotPlayer
from game.services import MatchmakingService, RatingService
from tests.factories import UserFactory, MatchFactory, BotPlayerFactory

User = get_user_model()


class MatchmakingServiceTest(TestCase):
    """Test cases for MatchmakingService."""
    
    def setUp(self):
        self.service = MatchmakingService()
        self.player1 = UserFactory.create(rating=1000)
        self.player2 = UserFactory.create(rating=1050)
        self.player3 = UserFactory.create(rating=1200)
    
    def test_join_queue_success(self):
        """Test successful queue joining."""
        queue_entry = self.service.join_queue(self.player1)
        
        self.assertIsInstance(queue_entry, MatchmakingQueue)
        self.assertEqual(queue_entry.player, self.player1)
        self.assertEqual(queue_entry.status, MatchmakingQueue.Status.WAITING)
        self.assertTrue(queue_entry.allow_bots)
    
    def test_join_queue_removes_existing_entries(self):
        """Test that joining queue removes existing entries."""
        # Create existing queue entry
        existing_entry = MatchmakingQueue.objects.create(
            player=self.player1,
            status=MatchmakingQueue.Status.WAITING
        )
        
        # Join queue again
        queue_entry = self.service.join_queue(self.player1)
        
        # Old entry should be cancelled
        existing_entry.refresh_from_db()
        self.assertEqual(existing_entry.status, MatchmakingQueue.Status.CANCELLED)
        
        # New entry should exist
        self.assertEqual(queue_entry.player, self.player1)
        self.assertEqual(queue_entry.status, MatchmakingQueue.Status.WAITING)
    
    def test_leave_queue_success(self):
        """Test successful queue leaving."""
        # Join queue first
        self.service.join_queue(self.player1)
        
        # Leave queue
        count = self.service.leave_queue(self.player1)
        
        self.assertEqual(count, 1)
        
        # Check entry is cancelled
        queue_entry = MatchmakingQueue.objects.get(player=self.player1)
        self.assertEqual(queue_entry.status, MatchmakingQueue.Status.CANCELLED)
    
    def test_leave_queue_no_entries(self):
        """Test leaving queue when no entries exist."""
        count = self.service.leave_queue(self.player1)
        self.assertEqual(count, 0)
    
    @patch('game.services.async_to_sync')
    def test_process_queue_player_matching(self, mock_async):
        """Test queue processing with player matching."""
        mock_async.return_value = MagicMock()
        
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
    
    @patch('game.services.async_to_sync')
    def test_process_queue_bot_matching(self, mock_async):
        """Test queue processing with bot matching."""
        mock_async.return_value = MagicMock()
        
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
    
    def test_find_player_matches_rating_compatibility(self):
        """Test player matching based on rating compatibility."""
        # Players with compatible ratings
        player_a = UserFactory.create(rating=1000)
        player_b = UserFactory.create(rating=1100)  # 100 difference
        
        # Players with incompatible ratings
        player_c = UserFactory.create(rating=800)   # 200 difference from player_a
        player_d = UserFactory.create(rating=1300)  # 300 difference from player_b
        
        # All join queue
        self.service.join_queue(player_a)
        self.service.join_queue(player_b)
        self.service.join_queue(player_c)
        self.service.join_queue(player_d)
        
        # Get waiting players
        waiting_players = MatchmakingQueue.objects.filter(
            status=MatchmakingQueue.Status.WAITING
        ).order_by('created_at')
        
        # Find matches
        matches = self.service._find_player_matches(waiting_players)
        
        # Should match compatible players
        self.assertEqual(len(matches), 1)
        matched_players = {matches[0][0].player, matches[0][1].player}
        self.assertEqual(matched_players, {player_a, player_b})
    
    def test_get_suitable_bot_existing(self):
        """Test getting suitable bot when one exists."""
        # Create existing bot
        bot_user = UserFactory.create(is_bot=True, bot_difficulty='hard')
        bot_player = BotPlayerFactory.create(
            user=bot_user,
            difficulty='hard',
            is_active=True
        )
        
        # Create queue entry
        queue_entry = MatchmakingQueue.objects.create(
            player=self.player1,
            preferred_difficulty='hard',
            allow_bots=True
        )
        
        # Get suitable bot
        bot = self.service._get_suitable_bot(queue_entry)
        
        self.assertEqual(bot, bot_player)
    
    @patch('game.services.async_to_sync')
    def test_get_suitable_bot_create_new(self, mock_async):
        """Test creating new bot when none exists."""
        mock_async.return_value = MagicMock()
        
        # Create queue entry
        queue_entry = MatchmakingQueue.objects.create(
            player=self.player1,
            preferred_difficulty='easy',
            allow_bots=True
        )
        
        # Get suitable bot (should create new one)
        bot = self.service._get_suitable_bot(queue_entry)
        
        self.assertIsNotNone(bot)
        self.assertEqual(bot.difficulty, 'easy')
        self.assertEqual(bot.user.rating, 800)  # Easy bot rating
        self.assertTrue(bot.user.is_bot)
    
    def test_get_bot_rating(self):
        """Test bot rating calculation."""
        easy_rating = self.service._get_bot_rating('easy')
        medium_rating = self.service._get_bot_rating('medium')
        hard_rating = self.service._get_bot_rating('hard')
        
        self.assertEqual(easy_rating, 800)
        self.assertEqual(medium_rating, 1000)
        self.assertEqual(hard_rating, 1200)
    
    @patch('game.services.async_to_sync')
    def test_create_match_with_bot(self, mock_async):
        """Test creating match with bot."""
        mock_async.return_value = MagicMock()
        
        # Create bot
        bot_user = UserFactory.create(is_bot=True)
        bot_player = BotPlayerFactory.create(user=bot_user)
        
        # Create queue entry
        queue_entry = MatchmakingQueue.objects.create(
            player=self.player1,
            allow_bots=True
        )
        
        # Create match
        match = self.service._create_match_with_bot(queue_entry, bot_player)
        
        self.assertIsInstance(match, Match)
        self.assertEqual(match.player1, self.player1)
        self.assertEqual(match.player2, bot_user)
        self.assertEqual(match.status, Match.Status.ACTIVE)
    
    @patch('game.services.async_to_sync')
    def test_create_match_players(self, mock_async):
        """Test creating match between two players."""
        mock_async.return_value = MagicMock()
        
        # Create queue entries
        queue_entry1 = MatchmakingQueue.objects.create(player=self.player1)
        queue_entry2 = MatchmakingQueue.objects.create(player=self.player2)
        
        # Create match
        match = self.service._create_match(queue_entry1, queue_entry2)
        
        self.assertIsInstance(match, Match)
        self.assertEqual(match.player1, self.player1)
        self.assertEqual(match.player2, self.player2)
        self.assertEqual(match.status, Match.Status.ACTIVE)
        
        # Check queue entries are marked as matched
        queue_entry1.refresh_from_db()
        queue_entry2.refresh_from_db()
        
        self.assertEqual(queue_entry1.status, MatchmakingQueue.Status.MATCHED)
        self.assertEqual(queue_entry2.status, MatchmakingQueue.Status.MATCHED)
        self.assertEqual(queue_entry1.match, match)
        self.assertEqual(queue_entry2.match, match)


class RatingServiceTest(TestCase):
    """Test cases for RatingService."""
    
    def setUp(self):
        self.player1 = UserFactory.create(rating=1000)
        self.player2 = UserFactory.create(rating=1000)
    
    def test_elo_calculation_equal_ratings_player1_wins(self):
        """Test ELO calculation with equal ratings, player1 wins."""
        new_rating1, new_rating2 = RatingService.calculate_new_ratings(
            1000, 1000, 'player1'
        )
        
        self.assertEqual(new_rating1, 1016)  # Winner gains 16 points
        self.assertEqual(new_rating2, 984)   # Loser loses 16 points
    
    def test_elo_calculation_equal_ratings_player2_wins(self):
        """Test ELO calculation with equal ratings, player2 wins."""
        new_rating1, new_rating2 = RatingService.calculate_new_ratings(
            1000, 1000, 'player2'
        )
        
        self.assertEqual(new_rating1, 984)   # Loser loses 16 points
        self.assertEqual(new_rating2, 1016)  # Winner gains 16 points
    
    def test_elo_calculation_equal_ratings_draw(self):
        """Test ELO calculation with equal ratings, draw."""
        new_rating1, new_rating2 = RatingService.calculate_new_ratings(
            1000, 1000, 'draw'
        )
        
        # In a draw, ratings move slightly towards each other
        self.assertEqual(new_rating1, 1008)
        self.assertEqual(new_rating2, 1008)
    
    def test_elo_calculation_higher_rated_wins(self):
        """Test ELO calculation when higher rated player wins."""
        new_rating1, new_rating2 = RatingService.calculate_new_ratings(
            1200, 1000, 'player1'  # Player1 is higher rated and wins
        )
        
        # Higher rated player gains fewer points
        self.assertEqual(new_rating1, 1208)  # Gains only 8 points
        self.assertEqual(new_rating2, 992)   # Loses 8 points
    
    def test_elo_calculation_upset_win(self):
        """Test ELO calculation when lower rated player wins (upset)."""
        new_rating1, new_rating2 = RatingService.calculate_new_ratings(
            1000, 1200, 'player2'  # Lower rated player2 wins
        )
        
        # Lower rated player gains more points for upset
        self.assertEqual(new_rating1, 992)   # Loses 8 points
        self.assertEqual(new_rating2, 1208)  # Gains 8 points
    
    def test_elo_calculation_extreme_rating_difference(self):
        """Test ELO calculation with extreme rating difference."""
        new_rating1, new_rating2 = RatingService.calculate_new_ratings(
            1500, 800, 'player1'  # Very high rated player wins
        )
        
        # Expected score for player1 is very high, so gains minimal points
        self.assertEqual(new_rating1, 1504)  # Gains only 4 points
        self.assertEqual(new_rating2, 796)   # Loses 4 points
    
    def test_expected_score_calculation(self):
        """Test expected score calculation."""
        # Equal ratings
        expected = RatingService._expected_score(1000, 1000)
        self.assertAlmostEqual(expected, 0.5, places=3)
        
        # Higher rated player
        expected = RatingService._expected_score(1200, 1000)
        self.assertGreater(expected, 0.5)
        self.assertLess(expected, 1.0)
        
        # Lower rated player
        expected = RatingService._expected_score(800, 1000)
        self.assertLess(expected, 0.5)
        self.assertGreater(expected, 0.0)
    
    def test_update_match_ratings_player1_wins(self):
        """Test updating ratings after match where player1 wins."""
        # Create finished match
        match = MatchFactory.create(
            player1=self.player1,
            player2=self.player2,
            status=Match.Status.FINISHED,
            winner=self.player1
        )
        
        # Update ratings
        RatingService.update_match_ratings(match)
        
        # Refresh players from database
        self.player1.refresh_from_db()
        self.player2.refresh_from_db()
        
        # Check ratings were updated
        self.assertEqual(self.player1.rating, 1016)
        self.assertEqual(self.player2.rating, 984)
    
    def test_update_match_ratings_player2_wins(self):
        """Test updating ratings after match where player2 wins."""
        # Create finished match
        match = MatchFactory.create(
            player1=self.player1,
            player2=self.player2,
            status=Match.Status.FINISHED,
            winner=self.player2
        )
        
        # Update ratings
        RatingService.update_match_ratings(match)
        
        # Refresh players from database
        self.player1.refresh_from_db()
        self.player2.refresh_from_db()
        
        # Check ratings were updated
        self.assertEqual(self.player1.rating, 984)
        self.assertEqual(self.player2.rating, 1016)
    
    def test_update_match_ratings_not_finished(self):
        """Test that ratings are not updated for unfinished matches."""
        # Create active match
        match = MatchFactory.create(
            player1=self.player1,
            player2=self.player2,
            status=Match.Status.ACTIVE,
            winner=None
        )
        
        # Store original ratings
        original_rating1 = self.player1.rating
        original_rating2 = self.player2.rating
        
        # Try to update ratings
        RatingService.update_match_ratings(match)
        
        # Refresh players from database
        self.player1.refresh_from_db()
        self.player2.refresh_from_db()
        
        # Ratings should not have changed
        self.assertEqual(self.player1.rating, original_rating1)
        self.assertEqual(self.player2.rating, original_rating2)
    
    def test_update_match_ratings_with_bot(self):
        """Test updating ratings when one player is a bot."""
        # Create bot player
        bot_user = UserFactory.create(is_bot=True, rating=1000)
        
        # Create finished match with bot
        match = MatchFactory.create(
            player1=self.player1,
            player2=bot_user,
            status=Match.Status.FINISHED,
            winner=self.player1
        )
        
        # Update ratings
        RatingService.update_match_ratings(match)
        
        # Refresh players from database
        self.player1.refresh_from_db()
        bot_user.refresh_from_db()
        
        # Check ratings were updated
        self.assertEqual(self.player1.rating, 1016)
        self.assertEqual(bot_user.rating, 984)
