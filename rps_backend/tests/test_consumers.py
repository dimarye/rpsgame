import pytest
import json
from unittest.mock import AsyncMock, MagicMock, patch
from channels.testing import WebsocketCommunicator
from channels.routing import URLRouter
from channels.auth import AuthMiddlewareStack
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from game.consumers import MatchConsumer
from game.models import Match, Move
from tests.factories import UserFactory, MatchFactory, MoveFactory, BotPlayerFactory
from game.routing import websocket_urlpatterns

User = get_user_model()


class MatchConsumerTest(TestCase):
    """Test cases for MatchConsumer WebSocket."""
    
    def setUp(self):
        self.user = UserFactory.create()
        self.match = MatchFactory.create(player1=self.user, player2=None, status='pending')
        self.token = RefreshToken.for_user(self.user)
        self.access_token = str(self.token.access_token)
    
    @pytest.mark.asyncio
    async def test_websocket_connection(self):
        """Test WebSocket connection with valid token."""
        application = AuthMiddlewareStack(URLRouter(websocket_urlpatterns))
        
        communicator = WebsocketCommunicator(
            application,
            f"/ws/match/{self.match.id}/?token={self.access_token}"
        )
        
        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)
        
        # Test initial state message
        response = await communicator.receive_json_from()
        self.assertEqual(response['type'], 'match_state')
        self.assertEqual(response['id'], self.match.id)
        
        await communicator.disconnect()
    
    @pytest.mark.asyncio
    async def test_websocket_connection_invalid_token(self):
        """Test WebSocket connection with invalid token."""
        application = AuthMiddlewareStack(URLRouter(websocket_urlpatterns))
        
        communicator = WebsocketCommunicator(
            application,
            f"/ws/match/{self.match.id}/?token=invalid_token"
        )
        
        connected, subprotocol = await communicator.connect()
        self.assertFalse(connected)
    
    @pytest.mark.asyncio
    async def test_websocket_connection_no_token(self):
        """Test WebSocket connection without token."""
        application = AuthMiddlewareStack(URLRouter(websocket_urlpatterns))
        
        communicator = WebsocketCommunicator(
            application,
            f"/ws/match/{self.match.id}/"
        )
        
        connected, subprotocol = await communicator.connect()
        self.assertFalse(connected)
    
    @pytest.mark.asyncio
    async def test_websocket_sync_request(self):
        """Test sync request message."""
        application = AuthMiddlewareStack(URLRouter(websocket_urlpatterns))
        
        communicator = WebsocketCommunicator(
            application,
            f"/ws/match/{self.match.id}/?token={self.access_token}"
        )
        
        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)
        
        # Clear initial state message
        await communicator.receive_json_from()
        
        # Send sync request
        await communicator.send_json_to({"type": "sync"})
        
        # Receive sync response
        response = await communicator.receive_json_from()
        self.assertEqual(response['type'], 'state')
        self.assertIn('status', response)
        
        await communicator.disconnect()
    
    @pytest.mark.asyncio
    async def test_websocket_move_submission(self):
        """Test move submission via WebSocket."""
        # Create active match with both players
        opponent = UserFactory.create()
        self.match.player2 = opponent
        self.match.status = 'active'
        self.match.save()
        
        application = AuthMiddlewareStack(URLRouter(websocket_urlpatterns))
        
        communicator = WebsocketCommunicator(
            application,
            f"/ws/match/{self.match.id}/?token={self.access_token}"
        )
        
        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)
        
        # Clear initial state message
        await communicator.receive_json_from()
        
        # Submit move
        await communicator.send_json_to({
            "type": "move",
            "payload": {"choice": "rock"}
        })
        
        # Receive move confirmation
        response = await communicator.receive_json_from(timeout=5)
        self.assertEqual(response['type'], 'move')
        self.assertEqual(response['choice'], 'rock')
        
        await communicator.disconnect()
    
    @pytest.mark.asyncio
    async def test_websocket_multiple_connections(self):
        """Test multiple WebSocket connections to same match."""
        opponent = UserFactory.create()
        opponent_token = RefreshToken.for_user(opponent)
        
        # Set up match with both players
        self.match.player2 = opponent
        self.match.status = 'active'
        self.match.save()
        
        application = AuthMiddlewareStack(URLRouter(websocket_urlpatterns))
        
        # Connect first player
        communicator1 = WebsocketCommunicator(
            application,
            f"/ws/match/{self.match.id}/?token={self.access_token}"
        )
        
        connected1, _ = await communicator1.connect()
        self.assertTrue(connected1)
        
        # Clear initial state
        await communicator1.receive_json_from()
        
        # Connect second player
        communicator2 = WebsocketCommunicator(
            application,
            f"/ws/match/{self.match.id}/?token={str(opponent_token.access_token)}"
        )
        
        connected2, _ = await communicator2.connect()
        self.assertTrue(connected2)
        
        # Clear initial state
        await communicator2.receive_json_from()
        
        # First player submits move
        await communicator1.send_json_to({
            "type": "move",
            "payload": {"choice": "rock"}
        })
        
        # Second player should receive move notification
        response = await communicator2.receive_json_from(timeout=5)
        self.assertEqual(response['type'], 'move')
        self.assertEqual(response['choice'], 'rock')
        
        await communicator1.disconnect()
        await communicator2.disconnect()
    
    @pytest.mark.asyncio
    async def test_websocket_bot_interaction(self):
        """Test WebSocket interaction with bot players."""
        # Create bot user and match
        bot_user = UserFactory.create(is_bot=True, bot_difficulty='medium')
        self.match.player2 = bot_user
        self.match.status = 'active'
        self.match.save()
        
        application = AuthMiddlewareStack(URLRouter(websocket_urlpatterns))
        
        communicator = WebsocketCommunicator(
            application,
            f"/ws/match/{self.match.id}/?token={self.access_token}"
        )
        
        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)
        
        # Clear initial state message
        await communicator.receive_json_from()
        
        # Submit move
        await communicator.send_json_to({
            "type": "move",
            "payload": {"choice": "rock"}
        })
        
        # Should receive both human move and bot move
        human_response = await communicator.receive_json_from(timeout=5)
        self.assertEqual(human_response['type'], 'move')
        self.assertEqual(human_response['choice'], 'rock')
        
        # Bot should respond automatically
        bot_response = await communicator.receive_json_from(timeout=5)
        self.assertEqual(bot_response['type'], 'move')
        self.assertIn(bot_response['choice'], ['rock', 'paper', 'scissors'])
        
        await communicator.disconnect()
    
    @pytest.mark.asyncio
    async def test_websocket_invalid_message_type(self):
        """Test WebSocket with invalid message type."""
        application = AuthMiddlewareStack(URLRouter(websocket_urlpatterns))
        
        communicator = WebsocketCommunicator(
            application,
            f"/ws/match/{self.match.id}/?token={self.access_token}"
        )
        
        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)
        
        # Clear initial state message
        await communicator.receive_json_from()
        
        # Send invalid message
        await communicator.send_json_to({"type": "invalid_type", "payload": {}})
        
        # Should receive error message
        response = await communicator.receive_json_from(timeout=5)
        self.assertEqual(response['type'], 'error')
        self.assertIn('message', response)
        
        await communicator.disconnect()
    
    @pytest.mark.asyncio
    async def test_websocket_unauthorized_match_access(self):
        """Test WebSocket connection to match user is not part of."""
        other_user = UserFactory.create()
        other_match = MatchFactory.create(player1=other_user)
        other_token = RefreshToken.for_user(other_user)
        
        application = AuthMiddlewareStack(URLRouter(websocket_urlpatterns))
        
        communicator = WebsocketCommunicator(
            application,
            f"/ws/match/{other_match.id}/?token={str(other_token.access_token)}"
        )
        
        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)  # Should connect but receive error
        
        # Should receive error message
        response = await communicator.receive_json_from(timeout=5)
        self.assertEqual(response['type'], 'error')
        
        await communicator.disconnect()


class GameConsumerTest(TestCase):
    """Test cases for GameConsumer WebSocket."""
    
    def setUp(self):
        self.user = UserFactory.create()
        self.match = MatchFactory.create(player1=self.user, status='active')
        self.token = RefreshToken.for_user(self.user)
        
        # Create application with authentication middleware
        self.application = AuthMiddlewareStack(URLRouter(websocket_urlpatterns))
    
    async def test_websocket_connect_success(self):
        """Test successful WebSocket connection."""
        communicator = WebsocketCommunicator(
            self.application,
            f"/ws/match/{self.match.id}/?token={self.token.access_token}"
        )
        
        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)
        
        await communicator.disconnect()
    
    async def test_websocket_connect_invalid_token(self):
        """Test WebSocket connection with invalid token."""
        communicator = WebsocketCommunicator(
            self.application,
            f"/ws/match/{self.match.id}/?token=invalid_token"
        )
        
        connected, subprotocol = await communicator.connect()
        self.assertFalse(connected)
    
    async def test_websocket_connect_no_match(self):
        """Test WebSocket connection to non-existent match."""
        communicator = WebsocketCommunicator(
            self.application,
            f"/ws/match/99999/?token={self.token.access_token}"
        )
        
        connected, subprotocol = await communicator.connect()
        self.assertFalse(connected)
    
    async def test_websocket_receive_message(self):
        """Test receiving messages through WebSocket."""
        communicator = WebsocketCommunicator(
            self.application,
            f"/ws/match/{self.match.id}/?token={self.token.access_token}"
        )
        
        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)
        
        # Send a test message
        message = {"type": "test", "data": "hello"}
        await communicator.send_json_to(message)
        
        # Receive response (timeout after 1 second)
        response = await communicator.receive_json_from(timeout=1)
        
        await communicator.disconnect()
    
    async def test_handle_move_valid(self):
        """Test handling valid move message."""
        communicator = WebsocketCommunicator(
            self.application,
            f"/ws/match/{self.match.id}/?token={self.token.access_token}"
        )
        
        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)
        
        # Send a valid move
        move_message = {
            "type": "move",
            "payload": {"choice": "rock"}
        }
        await communicator.send_json_to(move_message)
        
        # Check that move was created
        await communicator.disconnect()
        
        # Verify move was created in database
        move_exists = Move.objects.filter(
            match=self.match,
            player=self.user,
            choice='rock'
        ).exists()
        self.assertTrue(move_exists)
    
    async def test_handle_move_invalid_choice(self):
        """Test handling move with invalid choice."""
        communicator = WebsocketCommunicator(
            self.application,
            f"/ws/match/{self.match.id}/?token={self.token.access_token}"
        )
        
        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)
        
        # Send invalid move
        move_message = {
            "type": "move",
            "payload": {"choice": "invalid_choice"}
        }
        await communicator.send_json_to(move_message)
        
        # Should receive error message
        response = await communicator.receive_json_from(timeout=1)
        self.assertEqual(response['type'], 'error')
        
        await communicator.disconnect()
    
    async def test_handle_sync_request(self):
        """Test handling sync request message."""
        communicator = WebsocketCommunicator(
            self.application,
            f"/ws/match/{self.match.id}/?token={self.token.access_token}"
        )
        
        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)
        
        # Send sync request
        sync_message = {"type": "sync_request"}
        await communicator.send_json_to(sync_message)
        
        # Should receive state response
        response = await communicator.receive_json_from(timeout=1)
        self.assertEqual(response['type'], 'state')
        
        await communicator.disconnect()
    
    async def test_handle_start_game(self):
        """Test handling start game message."""
        communicator = WebsocketCommunicator(
            self.application,
            f"/ws/match/{self.match.id}/?token={self.token.access_token}"
        )
        
        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)
        
        # Send start game message
        start_message = {"type": "start_game"}
        await communicator.send_json_to(start_message)
        
        # Should receive match state
        response = await communicator.receive_json_from(timeout=1)
        self.assertEqual(response['type'], 'match_state')
        
        await communicator.disconnect()
    
    async def test_handle_invalid_message_type(self):
        """Test handling invalid message type."""
        communicator = WebsocketCommunicator(
            self.application,
            f"/ws/match/{self.match.id}/?token={self.token.access_token}"
        )
        
        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)
        
        # Send invalid message type
        invalid_message = {"type": "invalid_type", "payload": {}}
        await communicator.send_json_to(invalid_message)
        
        # Should receive error message
        response = await communicator.receive_json_from(timeout=1)
        self.assertEqual(response['type'], 'error')
        
        await communicator.disconnect()
    
    async def test_websocket_disconnect(self):
        """Test WebSocket disconnection."""
        communicator = WebsocketCommunicator(
            self.application,
            f"/ws/match/{self.match.id}/?token={self.token.access_token}"
        )
        
        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)
        
        # Disconnect
        await communicator.disconnect()
        
        # Should handle gracefully (no exception)
    
    async def test_bot_move_handling(self):
        """Test bot move handling in WebSocket."""
        # Create match with bot
        bot_user = UserFactory.create(is_bot=True, bot_difficulty='medium')
        bot_player = BotPlayerFactory.create(user=bot_user)
        match_with_bot = MatchFactory.create(
            player1=self.user,
            player2=bot_user,
            status='active'
        )
        
        communicator = WebsocketCommunicator(
            self.application,
            f"/ws/match/{match_with_bot.id}/?token={self.token.access_token}"
        )
        
        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)
        
        # Send player move
        move_message = {
            "type": "move",
            "payload": {"choice": "rock"}
        }
        await communicator.send_json_to(move_message)
        
        # Wait a bit for bot to respond (bot has delay)
        await communicator.receive_json_from(timeout=5)
        
        await communicator.disconnect()
        
        # Check that bot move was created
        bot_move_exists = Move.objects.filter(
            match=match_with_bot,
            player=bot_user,
        ).exists()
        self.assertTrue(bot_move_exists)
    
    async def test_multiple_connections_same_match(self):
        """Test multiple connections to the same match."""
        user2 = UserFactory.create()
        token2 = RefreshToken.for_user(user2)
        
        # Create match with both players
        match = MatchFactory.create(player1=self.user, player2=user2, status='active')
        
        # Connect both players
        communicator1 = WebsocketCommunicator(
            self.application,
            f"/ws/match/{match.id}/?token={self.token.access_token}"
        )
        communicator2 = WebsocketCommunicator(
            self.application,
            f"/ws/match/{match.id}/?token={token2.access_token}"
        )
        
        connected1, _ = await communicator1.connect()
        connected2, _ = await communicator2.connect()
        
        self.assertTrue(connected1)
        self.assertTrue(connected2)
        
        # Send move from player 1
        move_message = {
            "type": "move",
            "payload": {"choice": "rock"}
        }
        await communicator1.send_json_to(move_message)
        
        # Both players should receive move notification
        response1 = await communicator1.receive_json_from(timeout=1)
        response2 = await communicator2.receive_json_from(timeout=1)
        
        self.assertEqual(response1['type'], 'move_made')
        self.assertEqual(response2['type'], 'move_made')
        
        await communicator1.disconnect()
        await communicator2.disconnect()


class GameConsumerUnitTests(TestCase):
    """Unit tests for GameConsumer methods."""
    
    def setUp(self):
        self.user = UserFactory.create()
        self.match = MatchFactory.create(player1=self.user, status='active')
        self.consumer = GameConsumer()
        self.consumer.match_id = str(self.match.id)
        self.consumer.user = self.user
        self.consumer.match_group_name = f"match_{self.match.id}"
    
    def test_determine_winner(self):
        """Test winner determination logic."""
        # Test rock beats scissors
        result = self.consumer.determine_winner('rock', 'scissors')
        self.assertEqual(result, 'player1')
        
        # Test scissors beats paper
        result = self.consumer.determine_winner('scissors', 'paper')
        self.assertEqual(result, 'player1')
        
        # Test paper beats rock
        result = self.consumer.determine_winner('paper', 'rock')
        self.assertEqual(result, 'player1')
        
        # Test reverse cases
        result = self.consumer.determine_winner('scissors', 'rock')
        self.assertEqual(result, 'player2')
        
        # Test draw
        result = self.consumer.determine_winner('rock', 'rock')
        self.assertEqual(result, 'draw')
    
    @patch('game.consumers.database_sync_to_async')
    async def test_create_move(self, mock_sync_to_async):
        """Test move creation."""
        mock_create = AsyncMock()
        mock_sync_to_async.return_value = mock_create
        
        await self.consumer.create_move('rock')
        
        mock_create.assert_called_once()
        call_args = mock_create.call_args
        self.assertEqual(call_args[1]['choice'], 'rock')
    
    async def test_send_error(self):
        """Test error message sending."""
        self.consumer.channel_layer = AsyncMock()
        
        await self.consumer.send_error("Test error")
        
        self.consumer.channel_layer.group_send.assert_called_once()
        call_args = self.consumer.channel_layer.group_send.call_args
        self.assertEqual(call_args[0][0], self.consumer.match_group_name)
        self.assertEqual(call_args[0][1]['type'], 'error')
    
    async def test_send_match_state(self):
        """Test match state sending."""
        self.consumer.channel_layer = AsyncMock()
        
        await self.consumer.send_match_state()
        
        self.consumer.channel_layer.group_send.assert_called_once()
        call_args = self.consumer.channel_layer.group_send.call_args
        self.assertEqual(call_args[0][0], self.consumer.match_group_name)
        self.assertEqual(call_args[0][1]['type'], 'match_state')
    
    @patch('game.consumers.database_sync_to_async')
    async def test_get_match(self, mock_sync_to_async):
        """Test match retrieval."""
        mock_get = AsyncMock(return_value=self.match)
        mock_sync_to_async.return_value = mock_get
        
        result = await self.consumer.get_match()
        
        self.assertEqual(result, self.match)
        mock_get.assert_called_once_with(Match.objects.get, id=self.match.id)
    
    async def test_invalid_message_handling(self):
        """Test handling of invalid JSON messages."""
        # This would be tested through the WebSocket communicator
        # but we can test the error handling logic
        self.consumer.channel_layer = AsyncMock()
        
        # Simulate receiving invalid JSON (this would be called by the framework)
        await self.consumer.send_error("Invalid message format")
        
        self.consumer.channel_layer.group_send.assert_called_once()
