import pytest
import json
from unittest.mock import patch, AsyncMock
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from channels.testing import WebsocketCommunicator
from channels.auth import AuthMiddlewareStack
from channels.routing import URLRouter
from game.models import Match, Move, Round
from game.services import MatchmakingService, RatingService
from tests.factories import (
    UserFactory, MatchFactory, MoveFactory, RoundFactory,
    BotPlayerFactory, MatchmakingQueueFactory
)
from game.routing import websocket_urlpatterns

User = get_user_model()


class APIIntegrationTest(TestCase):
    """Integration tests for API endpoints."""
    
    def setUp(self):
        self.client = APIClient()
        self.user1 = UserFactory.create()
        self.user2 = UserFactory.create()
        self.token1 = RefreshToken.for_user(self.user1)
        self.token2 = RefreshToken.for_user(self.user2)
    
    def test_full_match_lifecycle_api(self):
        """Test complete match lifecycle through API."""
        # 1. Create match
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token1.access_token}')
        response = self.client.post('/api/matches/', {
            'wins_needed': 2
        })
        
        self.assertEqual(response.status_code, 201)
        match_id = response.data['id']
        
        # 2. Join match with second player
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token2.access_token}')
        response = self.client.post(f'/api/matches/{match_id}/join/')
        
        self.assertEqual(response.status_code, 200)
        
        # 3. Submit moves for first round
        # Player 1 move
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token1.access_token}')
        response = self.client.post(f'/api/matches/{match_id}/move/', {
            'choice': 'rock'
        })
        self.assertEqual(response.status_code, 201)
        
        # Player 2 move
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token2.access_token}')
        response = self.client.post(f'/api/matches/{match_id}/move/', {
            'choice': 'scissors'
        })
        self.assertEqual(response.status_code, 201)
        
        # 4. Check match status
        response = self.client.get(f'/api/matches/{match_id}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'active')
        
        # 5. Submit moves for second round
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token1.access_token}')
        response = self.client.post(f'/api/matches/{match_id}/move/', {
            'choice': 'paper'
        })
        self.assertEqual(response.status_code, 201)
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token2.access_token}')
        response = self.client.post(f'/api/matches/{match_id}/move/', {
            'choice': 'rock'
        })
        self.assertEqual(response.status_code, 201)
        
        # 6. Verify match completion (player1 should win 2-0)
        response = self.client.get(f'/api/matches/{match_id}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'finished')
        self.assertEqual(response.data['winner']['id'], self.user1.id)
    
    def test_matchmaking_integration(self):
        """Test matchmaking integration with API."""
        # 1. Both players join matchmaking
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token1.access_token}')
        response = self.client.post('/api/matchmaking/', {
            'preferred_difficulty': 'medium',
            'allow_bots': True
        })
        self.assertEqual(response.status_code, 200)
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token2.access_token}')
        response = self.client.post('/api/matchmaking/', {
            'preferred_difficulty': 'medium',
            'allow_bots': True
        })
        self.assertEqual(response.status_code, 200)
        
        # 2. Process matchmaking (this would normally be done by background task)
        matchmaking_service = MatchmakingService()
        matchmaking_service.process_queue()
        
        # 3. Check that match was created
        match = Match.objects.filter(
            status=Match.Status.ACTIVE
        ).first()
        self.assertIsNotNone(match)
        
        # 4. Verify both players are in the match
        players = {match.player1.id, match.player2.id}
        self.assertIn(self.user1.id, players)
        self.assertIn(self.user2.id, players)
    
    def test_quick_match_integration(self):
        """Test quick match API integration."""
        # 1. Request quick match
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token1.access_token}')
        response = self.client.post('/api/matchmaking/quick/')
        
        self.assertEqual(response.status_code, 200)
        self.assertIn('match_id', response.data)
        
        match_id = response.data['match_id']
        
        # 2. Verify match was created
        match = Match.objects.get(id=match_id)
        self.assertEqual(match.status, Match.Status.ACTIVE)
        self.assertEqual(match.player1, self.user1)
        self.assertTrue(match.player2.is_bot)
    
    def test_user_registration_and_login_flow(self):
        """Test complete user registration and login flow."""
        # 1. Register new user
        registration_data = {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': 'test123456',
            'password_confirm': 'test123456',
            'first_name': 'New',
            'last_name': 'User'
        }
        
        response = self.client.post('/api/auth/register/', registration_data)
        self.assertEqual(response.status_code, 201)
        
        # 2. Login with new user
        login_data = {
            'username': 'newuser',
            'password': 'test123456'
        }
        
        response = self.client.post('/api/auth/login/', login_data)
        self.assertEqual(response.status_code, 200)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        
        # 3. Use token to access protected endpoint
        token = response.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        
        response = self.client.get('/api/auth/users/me/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['username'], 'newuser')
    
    def test_rating_update_integration(self):
        """Test rating update after match completion."""
        # Set initial ratings
        self.user1.rating = 1000
        self.user1.save()
        self.user2.rating = 1000
        self.user2.save()
        
        # Create and finish match
        match = MatchFactory.create(
            player1=self.user1,
            player2=self.user2,
            status=Match.Status.FINISHED,
            winner=self.user1
        )
        
        # Update ratings
        RatingService.update_match_ratings(match)
        
        # Verify rating changes
        self.user1.refresh_from_db()
        self.user2.refresh_from_db()
        
        self.assertEqual(self.user1.rating, 1016)  # Winner gains 16 points
        self.assertEqual(self.user2.rating, 984)   # Loser loses 16 points


class WebSocketIntegrationTest(TestCase):
    """Integration tests for WebSocket communication."""
    
    def setUp(self):
        self.user1 = UserFactory.create()
        self.user2 = UserFactory.create()
        self.token1 = RefreshToken.for_user(self.user1)
        self.token2 = RefreshToken.for_user(self.user2)
        
        self.application = AuthMiddlewareStack(URLRouter(websocket_urlpatterns))
    
    async def test_complete_game_websocket_flow(self):
        """Test complete game flow through WebSocket."""
        # Create match
        match = MatchFactory.create(player1=self.user1, player2=self.user2, status='active')
        
        # Connect both players
        communicator1 = WebsocketCommunicator(
            self.application,
            f"/ws/match/{match.id}/?token={self.token1.access_token}"
        )
        communicator2 = WebsocketCommunicator(
            self.application,
            f"/ws/match/{match.id}/?token={self.token2.access_token}"
        )
        
        connected1, _ = await communicator1.connect()
        connected2, _ = await communicator2.connect()
        
        self.assertTrue(connected1)
        self.assertTrue(connected2)
        
        # 1. Start game
        await communicator1.send_json_to({"type": "start_game"})
        
        # Both should receive game start
        response1 = await communicator1.receive_json_from(timeout=1)
        response2 = await communicator2.receive_json_from(timeout=1)
        
        self.assertEqual(response1['type'], 'match_state')
        self.assertEqual(response2['type'], 'match_state')
        
        # 2. Player 1 makes move
        await communicator1.send_json_to({
            "type": "move",
            "payload": {"choice": "rock"}
        })
        
        # Both should receive move notification
        response1 = await communicator1.receive_json_from(timeout=1)
        response2 = await communicator2.receive_json_from(timeout=1)
        
        self.assertEqual(response1['type'], 'move_made')
        self.assertEqual(response2['type'], 'move_made')
        self.assertEqual(response1['player_id'], self.user1.id)
        
        # 3. Player 2 makes move
        await communicator2.send_json_to({
            "type": "move",
            "payload": {"choice": "scissors"}
        })
        
        # Both should receive round completion
        response1 = await communicator1.receive_json_from(timeout=1)
        response2 = await communicator2.receive_json_from(timeout=1)
        
        self.assertEqual(response1['type'], 'round_complete')
        self.assertEqual(response2['type'], 'round_complete')
        self.assertEqual(response1['winner']['id'], self.user1.id)
        
        # 4. Second round moves
        await communicator1.send_json_to({
            "type": "move",
            "payload": {"choice": "paper"}
        })
        
        await communicator2.send_json_to({
            "type": "move",
            "payload": {"choice": "rock"}
        })
        
        # 5. Should receive game completion
        response1 = await communicator1.receive_json_from(timeout=1)
        response2 = await communicator2.receive_json_from(timeout=1)
        
        self.assertEqual(response1['type'], 'game_complete')
        self.assertEqual(response2['type'], 'game_complete')
        self.assertEqual(response1['winner']['id'], self.user1.id)
        
        # Cleanup
        await communicator1.disconnect()
        await communicator2.disconnect()
    
    async def test_bot_game_websocket_flow(self):
        """Test game flow with bot through WebSocket."""
        # Create bot
        bot_user = UserFactory.create(is_bot=True, bot_difficulty='medium')
        bot_player = BotPlayerFactory.create(user=bot_user)
        
        # Create match with bot
        match = MatchFactory.create(player1=self.user1, player2=bot_user, status='active')
        
        # Connect human player
        communicator = WebsocketCommunicator(
            self.application,
            f"/ws/match/{match.id}/?token={self.token1.access_token}"
        )
        
        connected, _ = await communicator.connect()
        self.assertTrue(connected)
        
        # Start game
        await communicator.send_json_to({"type": "start_game"})
        response = await communicator.receive_json_from(timeout=1)
        self.assertEqual(response['type'], 'match_state')
        
        # Human player makes move
        await communicator.send_json_to({
            "type": "move",
            "payload": {"choice": "rock"}
        })
        
        # Should receive move notification
        response = await communicator.receive_json_from(timeout=1)
        self.assertEqual(response['type'], 'move_made')
        
        # Wait for bot to respond (with delay)
        response = await communicator.receive_json_from(timeout=5)
        self.assertEqual(response['type'], 'move_made')
        self.assertNotEqual(response['player_id'], self.user1.id)  # Bot's move
        
        # Should receive round completion
        response = await communicator.receive_json_from(timeout=1)
        self.assertEqual(response['type'], 'round_complete')
        
        await communicator.disconnect()
    
    async def test_reconnection_websocket_flow(self):
        """Test WebSocket reconnection flow."""
        # Create match
        match = MatchFactory.create(player1=self.user1, status='active')
        
        # First connection
        communicator1 = WebsocketCommunicator(
            self.application,
            f"/ws/match/{match.id}/?token={self.token1.access_token}"
        )
        
        connected, _ = await communicator1.connect()
        self.assertTrue(connected)
        
        # Send sync request to get state
        await communicator1.send_json_to({"type": "sync_request"})
        response = await communicator1.receive_json_from(timeout=1)
        self.assertEqual(response['type'], 'state')
        
        # Disconnect
        await communicator1.disconnect()
        
        # Reconnect
        communicator2 = WebsocketCommunicator(
            self.application,
            f"/ws/match/{match.id}/?token={self.token1.access_token}"
        )
        
        connected, _ = await communicator2.connect()
        self.assertTrue(connected)
        
        # Should be able to sync again
        await communicator2.send_json_to({"type": "sync_request"})
        response = await communicator2.receive_json_from(timeout=1)
        self.assertEqual(response['type'], 'state')
        
        await communicator2.disconnect()
    
    async def test_error_handling_websocket(self):
        """Test WebSocket error handling."""
        # Create match
        match = MatchFactory.create(player1=self.user1, status='active')
        
        # Connect
        communicator = WebsocketCommunicator(
            self.application,
            f"/ws/match/{match.id}/?token={self.token1.access_token}"
        )
        
        connected, _ = await communicator.connect()
        self.assertTrue(connected)
        
        # Send invalid move
        await communicator.send_json_to({
            "type": "move",
            "payload": {"choice": "invalid_choice"}
        })
        
        # Should receive error
        response = await communicator.receive_json_from(timeout=1)
        self.assertEqual(response['type'], 'error')
        self.assertIn('choice', response['message'])
        
        # Send invalid message type
        await communicator.send_json_to({
            "type": "invalid_type",
            "payload": {}
        })
        
        # Should receive error
        response = await communicator.receive_json_from(timeout=1)
        self.assertEqual(response['type'], 'error')
        
        await communicator.disconnect()


class DatabaseIntegrationTest(TestCase):
    """Integration tests for database interactions."""
    
    def setUp(self):
        self.user1 = UserFactory.create(rating=1000)
        self.user2 = UserFactory.create(rating=1000)
    
    def test_complete_match_database_flow(self):
        """Test complete match flow in database."""
        # 1. Create match
        match = MatchFactory.create(
            player1=self.user1,
            player2=self.user2,
            status=Match.Status.ACTIVE,
            wins_needed=2
        )
        
        # 2. Create first round with moves
        round1 = RoundFactory.create(
            match=match,
            round_number=1,
            winner=self.user1,
            is_draw=False
        )
        
        MoveFactory.create(match=match, player=self.user1, choice='rock')
        MoveFactory.create(match=match, player=self.user2, choice='scissors')
        
        # 3. Create second round with moves
        round2 = RoundFactory.create(
            match=match,
            round_number=2,
            winner=self.user1,
            is_draw=False
        )
        
        MoveFactory.create(match=match, player=self.user1, choice='paper')
        MoveFactory.create(match=match, player=self.user2, choice='rock')
        
        # 4. Complete match
        match.status = Match.Status.FINISHED
        match.winner = self.user1
        match.save()
        
        # 5. Update ratings
        RatingService.update_match_ratings(match)
        
        # 6. Verify all data is consistent
        match.refresh_from_db()
        
        # Match should be finished
        self.assertEqual(match.status, Match.Status.FINISHED)
        self.assertEqual(match.winner, self.user1)
        
        # Should have 2 rounds
        rounds = match.rounds.all()
        self.assertEqual(rounds.count(), 2)
        
        # Player1 should have won both rounds
        for round in rounds:
            self.assertEqual(round.winner, self.user1)
        
        # Should have 4 moves total
        moves = Move.objects.filter(match=match)
        self.assertEqual(moves.count(), 4)
        
        # Ratings should be updated
        self.user1.refresh_from_db()
        self.user2.refresh_from_db()
        
        self.assertEqual(self.user1.rating, 1032)  # Won 2 rounds, gained 32 points
        self.assertEqual(self.user2.rating, 968)   # Lost 2 rounds, lost 32 points
    
    def test_matchmaking_queue_database_flow(self):
        """Test matchmaking queue flow in database."""
        # 1. Join queue
        queue_entry1 = MatchmakingQueueFactory.create(
            player=self.user1,
            status=MatchmakingQueue.Status.WAITING
        )
        
        queue_entry2 = MatchmakingQueueFactory.create(
            player=self.user2,
            status=MatchmakingQueue.Status.WAITING
        )
        
        # 2. Process matchmaking
        matchmaking_service = MatchmakingService()
        matchmaking_service.process_queue()
        
        # 3. Verify queue entries are updated
        queue_entry1.refresh_from_db()
        queue_entry2.refresh_from_db()
        
        self.assertEqual(queue_entry1.status, MatchmakingQueue.Status.MATCHED)
        self.assertEqual(queue_entry2.status, MatchmakingQueue.Status.MATCHED)
        self.assertIsNotNone(queue_entry1.match)
        self.assertIsNotNone(queue_entry2.match)
        
        # 4. Verify match was created
        match = queue_entry1.match
        self.assertEqual(match.player1, self.user1)
        self.assertEqual(match.player2, self.user2)
        self.assertEqual(match.status, Match.Status.ACTIVE)
    
    def test_bot_creation_and_matching_flow(self):
        """Test bot creation and matching flow."""
        # 1. Create queue entry allowing bots
        queue_entry = MatchmakingQueueFactory.create(
            player=self.user1,
            preferred_difficulty='hard',
            allow_bots=True
        )
        
        # 2. Process matchmaking (should create bot)
        matchmaking_service = MatchmakingService()
        matchmaking_service.process_queue()
        
        # 3. Verify bot was created
        queue_entry.refresh_from_db()
        self.assertEqual(queue_entry.status, MatchmakingQueue.Status.MATCHED)
        
        match = queue_entry.match
        self.assertTrue(match.player2.is_bot)
        self.assertEqual(match.player2.bot_difficulty, 'hard')
        
        # 4. Verify bot profile exists
        from game.models_matchmaking import BotPlayer
        bot_profile = BotPlayer.objects.get(user=match.player2)
        self.assertEqual(bot_profile.difficulty, 'hard')
        self.assertTrue(bot_profile.is_active)
