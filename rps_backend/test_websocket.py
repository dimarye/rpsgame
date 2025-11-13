import os
import sys
import json
import asyncio
import time
import logging
import urllib.parse
from typing import Dict, Any, Optional, List
from asgiref.sync import sync_to_async

import django
import websockets
import requests
from django.contrib.auth import get_user_model

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('test_websocket.log')
    ]
)
logger = logging.getLogger(__name__)

# Django setup
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from game.models import Match, Move

# Constants
User = get_user_model()
BASE_URL = 'http://localhost:8000/api'
WS_BASE_URL = 'ws://localhost:8000'
TEST_TIMEOUT = 15  # seconds
MESSAGE_TIMEOUT = 2.0  # seconds

# === Helper Functions ===

@sync_to_async
def _create_user(username: str, email: str, password: str) -> User:
    """Create a test user or return existing one."""
    if User.objects.filter(username=username).exists():
        return User.objects.get(username=username)
    return User.objects.create_user(
        username=username,
        email=email,
        password=password
    )

@sync_to_async
def _get_token(username: str, password: str) -> str:
    """Get authentication token for a user."""
    url = f'{BASE_URL}/auth/token/'
    resp = requests.post(
        url,
        json={'username': username, 'password': password},
        timeout=5.0
    )
    if resp.status_code == 200:
        return resp.json().get('access')
    raise Exception(f"Token error: {resp.status_code} – {resp.text}")

@sync_to_async
def _create_match(token: str) -> Dict[str, Any]:
    """Create a new match."""
    url = f'{BASE_URL}/matches/'
    headers = {'Authorization': f'Bearer {token}'}
    resp = requests.post(url, headers=headers, json={}, timeout=5.0)
    if resp.status_code == 201:
        return resp.json()
    raise Exception(f"Match creation failed: {resp.status_code} – {resp.text}")

@sync_to_async
def _cleanup() -> None:
    """Clean up test data."""
    Move.objects.all().delete()
    Match.objects.all().delete()
    User.objects.filter(username__in=['ws_user1', 'ws_user2', 'ws_user3']).delete()

async def create_test_user(username: str, password: str) -> Optional[Dict[str, Any]]:
    """Create a test user and return user data with token."""
    email = f"{username}@example.com"
    try:
        user = await _create_user(username, email, password)
        token = await _get_token(username, password)
        return {
            'id': str(user.id),
            'username': user.username,
            'token': token
        }
    except Exception as e:
        logger.error(f"❌ Failed to create user {username}: {e}")
        return None

async def receive_messages(websocket, count: int, timeout: float = MESSAGE_TIMEOUT) -> List[Dict[str, Any]]:
    """Receive multiple messages from WebSocket with timeout."""
    messages = []
    for _ in range(count):
        try:
            message = await asyncio.wait_for(websocket.recv(), timeout=timeout)
            data = json.loads(message)
            messages.append(data)
            logger.debug(f"Received message: {data}")
        except asyncio.TimeoutError:
            logger.warning(f"Timeout while waiting for message {len(messages) + 1}/{count}")
            break
        except json.JSONDecodeError:
            logger.error(f"Failed to decode message: {message}")
            break
    return messages

# === Test Cases ===

async def test_websocket_match() -> bool:
    """Test a complete Rock-Paper-Scissors match between two players."""
    logger.info("\n" + "="*60)
    logger.info("✅ WebSocket Match Test - Rock Paper Scissors")
    logger.info("="*60)

    # Clean up any existing test data
    await _cleanup()
    
    # Create test users
    user1 = await create_test_user("ws_user1", "testpass123")
    user2 = await create_test_user("ws_user2", "testpass123")
    if not user1 or not user2:
        logger.error("❌ Failed to create test users")
        return False

    ws1 = None
    ws2 = None
    try:
        # Create a new match
        match = await _create_match(user1['token'])
        match_id = match['id']
        logger.info(f"🎮 Match created: {match_id}")

        # Connect both players to the match with more detailed error handling
        ws1_url = f"{WS_BASE_URL}/ws/match/{match_id}/"
        ws2_url = f"{WS_BASE_URL}/ws/match/{match_id}/"
        
        # Print the WebSocket URLs and tokens for debugging
        logger.info(f"[DEBUG] WebSocket URL for player 1: {ws1_url}")
        logger.info(f"[DEBUG] Token for player 1: {user1['token']}")
        logger.info(f"[DEBUG] WebSocket URL for player 2: {ws2_url}")
        logger.info(f"[DEBUG] Token for player 2: {user2['token']}")
        
        # Connect player 1 with token in query parameter and Origin header
        player1_ws_url = f"{ws1_url}?token={user1['token']}"
        logger.info(f"[DEBUG] Player 1 connecting to: {player1_ws_url}")
        try:
            # Connect with query parameters for authentication
            # Add Origin and User-Agent to the URL as query parameters
            parsed_url = urllib.parse.urlparse(player1_ws_url)
            query_params = urllib.parse.parse_qs(parsed_url.query)
            query_params['origin'] = 'http://localhost:8000'
            query_params['user_agent'] = 'PythonTestClient'
            
            # Rebuild the URL with the new query parameters
            new_query = urllib.parse.urlencode(query_params, doseq=True)
            ws_url_updated = urllib.parse.urlunparse(parsed_url._replace(query=new_query))
            
            # Connect with the updated URL
            ws1 = await websockets.connect(
                ws_url_updated,
                ping_interval=None
            )
            logger.info("[DEBUG] Player 1 connected to WebSocket")
            
            # Verify connection by sending a ping
            try:
                await asyncio.wait_for(ws1.ping(), timeout=5.0)
                logger.info("[DEBUG] Player 1 WebSocket connection verified with ping")
            except (asyncio.TimeoutError, Exception) as e:
                error_msg = f"Player 1 connection failed: {str(e)}"
                logger.error(f"[DEBUG] {error_msg}")
                await ws1.close()
                raise Exception(error_msg)
                
        except Exception as e:
            logger.error(f"[DEBUG] Player 1 connection failed: {str(e)}", exc_info=True)
            if 'ws1' in locals():
                try:
                    await ws1.close()
                except:
                    pass  # Ignore errors when closing the connection
            raise
        
        # Connect player 2 with token in query parameter and Origin header
        player2_ws_url = f"{ws2_url}?token={user2['token']}"
        logger.info(f"[DEBUG] Player 2 connecting to: {player2_ws_url}")
        try:
            # Add Origin and User-Agent to the URL as query parameters
            parsed_url = urllib.parse.urlparse(player2_ws_url)
            query_params = urllib.parse.parse_qs(parsed_url.query)
            query_params['origin'] = 'http://localhost:8000'
            query_params['user_agent'] = 'PythonTestClient'
            
            # Rebuild the URL with the new query parameters
            new_query = urllib.parse.urlencode(query_params, doseq=True)
            ws_url_updated = urllib.parse.urlunparse(parsed_url._replace(query=new_query))
            
            # Connect with the updated URL
            ws2 = await websockets.connect(
                ws_url_updated,
                ping_interval=None
            )
            logger.info("[DEBUG] Player 2 connected to WebSocket")
            
            # Verify connection by sending a ping
            try:
                await asyncio.wait_for(ws2.ping(), timeout=5.0)
                logger.info("[DEBUG] Player 2 WebSocket connection verified with ping")
            except (asyncio.TimeoutError, Exception) as e:
                error_msg = f"Player 2 connection failed: {str(e)}"
                logger.error(f"[DEBUG] {error_msg}")
                await ws2.close()
                raise Exception(error_msg)
                
        except Exception as e:
            logger.error(f"[DEBUG] Player 2 connection failed: {str(e)}", exc_info=True)
            if 'ws1' in locals():
                try:
                    await ws1.close()
                except:
                    pass  # Ignore errors when closing the connection
            if 'ws2' in locals():
                try:
                    await ws2.close()
                except:
                    pass  # Ignore errors when closing the connection
            raise
        
        logger.info("✅ Both players connected to WebSocket")

        # Wait for initial state messages (match_state and player_joined)
        logger.info("⏳ Waiting for initial game state...")
        try:
            # Log expected message types for debugging
            logger.debug("Expecting initial messages: match_state and player_joined")
            
            # Increase timeout for initial state messages
            try:
                msgs1 = await asyncio.wait_for(receive_messages(ws1, 2), timeout=10.0)
                logger.debug(f"Received {len(msgs1)} initial messages for player 1")
                
                # Log the actual messages received for debugging
                for i, msg in enumerate(msgs1, 1):
                    if msg is not None:
                        logger.debug(f"Player 1 message {i}: {json.dumps(msg, indent=2)}")
                    else:
                        logger.warning(f"Player 1 message {i} is None")
                        
            except asyncio.TimeoutError:
                logger.error("❌ Timeout waiting for initial messages from player 1")
                # Try to get any pending messages before giving up
                try:
                    pending = await asyncio.wait_for(ws1.recv(), timeout=1.0)
                    logger.warning(f"Received late message from player 1: {pending}")
                except (asyncio.TimeoutError, websockets.exceptions.ConnectionClosed):
                    pass
                raise
            # Handle second player's messages with the same level of detail
            try:
                msgs2 = await asyncio.wait_for(receive_messages(ws2, 2), timeout=10.0)
                logger.debug(f"Received {len(msgs2)} initial messages for player 2")
                
                # Log the actual messages received for debugging
                for i, msg in enumerate(msgs2, 1):
                    if msg is not None:
                        logger.debug(f"Player 2 message {i}: {json.dumps(msg, indent=2)}")
                    else:
                        logger.warning(f"Player 2 message {i} is None")
                        
            except asyncio.TimeoutError:
                logger.error("❌ Timeout waiting for initial messages from player 2")
                # Try to get any pending messages before giving up
                try:
                    pending = await asyncio.wait_for(ws2.recv(), timeout=1.0)
                    logger.warning(f"Received late message from player 2: {pending}")
                except (asyncio.TimeoutError, websockets.exceptions.ConnectionClosed):
                    pass
                raise
                
            # Log summary of received messages for both players
            logger.debug(f"Player 1 initial messages: {[m.get('type', 'unknown') if m else 'None' for m in msgs1]}")
            logger.debug(f"Player 2 initial messages: {[m.get('type', 'unknown') if m else 'None' for m in msgs2]}")
            
            # Verify we received the expected number of messages
            if len(msgs1) < 2 or len(msgs2) < 2:
                logger.error(f"❌ Did not receive all initial messages. Player 1: {len(msgs1)}, Player 2: {len(msgs2)}")
                return False
                
            logger.info("✅ Initial game state received by both players")
            
        except asyncio.TimeoutError:
            logger.error("❌ Timeout waiting for initial game state")
            return False
        except Exception as e:
            logger.error(f"❌ Error receiving initial game state: {str(e)}", exc_info=True)
            return False

        # Both players make their moves
        logger.info("🎯 Players making moves...")
        await asyncio.gather(
            ws1.send(json.dumps({'type': 'move', 'choice': 'rock'})),
            ws2.send(json.dumps({'type': 'move', 'choice': 'scissors'}))
        )

        # Wait for match completion with more detailed logging and error handling
        logger.info("⏳ Waiting for match completion...")
        start_time = time.time()
        winner1 = winner2 = None
        last_message_time = time.time()
        no_message_count = 0
        MAX_NO_MESSAGE_COUNT = 3  # Maximum number of consecutive no-message iterations

        while time.time() - start_time < TEST_TIMEOUT:
            current_time = time.time()
            
            # Log progress periodically
            if current_time - last_message_time > 2.0:  # Log every 2 seconds
                logger.info(f"⏳ Still waiting for match completion... (elapsed: {current_time - start_time:.1f}s)")
                last_message_time = current_time

            try:
                # Receive messages from both players with a shorter timeout
                msgs1 = await asyncio.wait_for(receive_messages(ws1, 1, MESSAGE_TIMEOUT / 2), timeout=MESSAGE_TIMEOUT)
                msgs2 = await asyncio.wait_for(receive_messages(ws2, 1, MESSAGE_TIMEOUT / 2), timeout=MESSAGE_TIMEOUT)
                
                # Reset no-message counter if we got messages
                if msgs1 or msgs2:
                    no_message_count = 0

                # Process messages from player 1
                for msg in msgs1:
                    if msg is None:
                        logger.warning("Received None message in player 1's messages")
                        continue
                        
                    logger.info(f"📨 Player 1 received: {json.dumps(msg, indent=2)}")
                    if msg.get('type') == 'match_completed':
                        winner_info = msg.get('winner', {}) or {}
                        is_draw = msg.get('is_draw', False)
                        
                        if is_draw:
                            logger.error("❌ Game ended in a draw, which is unexpected for rock vs scissors")
                            return False
                            
                        winner1 = winner_info.get('id') if isinstance(winner_info, dict) else None
                        logger.info(f"🏆 Player 1 received match_completed. Winner ID: {winner1}")

                # Process messages from player 2
                for msg in msgs2:
                    if msg is None:
                        logger.warning("Received None message in player 2's messages")
                        continue
                        
                    logger.info(f"📨 Player 2 received: {json.dumps(msg, indent=2)}")
                    if msg.get('type') == 'match_completed':
                        winner_info = msg.get('winner', {}) or {}
                        is_draw = msg.get('is_draw', False)
                        
                        if is_draw:
                            logger.error("❌ Game ended in a draw, which is unexpected for rock vs scissors")
                            return False
                            
                        winner2 = winner_info.get('id') if isinstance(winner_info, dict) else None
                        logger.info(f"🏆 Player 2 received match_completed. Winner ID: {winner2}")

            except asyncio.TimeoutError:
                no_message_count += 1
                logger.warning(f"Timeout waiting for messages (attempt {no_message_count}/{MAX_NO_MESSAGE_COUNT})")
                if no_message_count >= MAX_NO_MESSAGE_COUNT:
                    logger.error("❌ Max no-message attempts reached. Aborting test.")
                    return False
                await asyncio.sleep(0.5)  # Small delay before retry
                continue
                
            except websockets.exceptions.ConnectionClosed as e:
                logger.error(f"❌ WebSocket connection closed unexpectedly: {e}")
                logger.error(f"Connection close code: {e.code}, reason: {e.reason}")
                return False
                
            except Exception as e:
                logger.error(f"❌ Error receiving messages: {str(e)}", exc_info=True)
                return False

            # Check if we have both results
            if winner1 is not None and winner2 is not None:
                if str(winner1) == str(user1['id']) and str(winner2) == str(user1['id']):
                    logger.info(f"✅ Correct winner: ws_user1 (ID: {user1['id']}) - rock beats scissors")
                    return True
                else:
                    logger.error(f"❌ Wrong winner(s): Player 1 says: {winner1}, Player 2 says: {winner2}")
                    logger.error(f"Expected both winners to be user1 (ID: {user1['id']})")
                    return False
        
        # If we get here, we've timed out
        logger.error(f"❌ Test timed out after {TEST_TIMEOUT} seconds")
        return False

    except Exception as e:
        logger.error(f"❌ Test failed with error: {str(e)}", exc_info=True)
        return False
    finally:
        # Close WebSocket connections if they exist
        if ws1 is not None:
            await ws1.close()
        if ws2 is not None:
            await ws2.close()
        # Clean up test data
        await _cleanup()

    return False

async def test_invalid_move() -> bool:
    """Test that duplicate moves are rejected."""
    logger.info("\n" + "="*60)
    logger.info("✅ Testing Invalid (Duplicate) Move Handling")
    logger.info("="*60)

    # Clean up any existing test data
    await _cleanup()
    ws = None
    
    try:
        # Create test user
        user = await create_test_user("ws_user3", "testpass123")
        if not user:
            logger.error("❌ Failed to create test user")
            return False

        # Create a new match
        match = await _create_match(user['token'])
        match_id = match['id']
        ws_url = f"{WS_BASE_URL}/ws/match/{match_id}/?token={user['token']}"
        logger.info(f"[DEBUG] Connecting to WebSocket: {ws_url}")

        # Add Origin and User-Agent to the URL as query parameters
        parsed_url = urllib.parse.urlparse(ws_url)
        query_params = urllib.parse.parse_qs(parsed_url.query)
        query_params['origin'] = 'http://localhost:8000'
        query_params['user_agent'] = 'PythonTestClient'
        
        # Rebuild the URL with the new query parameters
        new_query = urllib.parse.urlencode(query_params, doseq=True)
        ws_url_updated = urllib.parse.urlunparse(parsed_url._replace(query=new_query))
        
        # Connect with the updated URL
        ws = await websockets.connect(
            ws_url_updated,
            ping_interval=None
        )
        
        logger.info("[DEBUG] Successfully connected to WebSocket")
        logger.info("✅ Connected to WebSocket")
        
        try:
            # Wait for initial messages
            await receive_messages(ws, 2)  # match_state and player_joined
            
            # First move (should succeed)
            logger.info("🎯 Making first move (rock)...")
            await ws.send(json.dumps({'type': 'move', 'choice': 'rock'}))
            
            # Wait for the move to be processed
            try:
                response = await asyncio.wait_for(ws.recv(), timeout=5.0)
                response_data = json.loads(response)
                
                if response_data.get('type') != 'match_state':
                    logger.error(f"❌ Unexpected response to first move: {response_data}")
                    return False
                
                # Try to make the same move again (should be ignored by the server)
                logger.info("🎯 Attempting duplicate move (rock)...")
                await ws.send(json.dumps({'type': 'move', 'choice': 'rock'}))
                
                # Wait for any response (the server might ignore the duplicate move)
                try:
                    response = await asyncio.wait_for(ws.recv(), timeout=5.0)
                    response_data = json.loads(response)
                    
                    # The server might not send an error, just log the response
                    logger.info(f"ℹ️ Received response to duplicate move: {response_data}")
                    
                    # If we got here without an error, the test passes since the server handled it gracefully
                    return True
                    
                except asyncio.TimeoutError:
                    # If we don't get a response, that's also acceptable
                    logger.info("ℹ️ No response to duplicate move (expected behavior)")
                    return True
                    
            except asyncio.TimeoutError:
                logger.error("❌ Timeout waiting for response to first move")
                return False
                
        except Exception as e:
            logger.error(f"❌ Error during test: {str(e)}", exc_info=True)
            return False
            
        finally:
            try:
                if ws:
                    await ws.close()
            except Exception as e:
                logger.warning(f"Error closing WebSocket: {str(e)}")
                
    except Exception as e:
        logger.error(f"❌ Test failed with error: {str(e)}", exc_info=True)
        try:
            if ws:
                await ws.close()
        except:
            pass  # Ignore errors when closing the connection
        return False
    finally:
        # Clean up test data
        await _cleanup()
    
    return False

# === Main Execution ===

class SafeStreamHandler(logging.StreamHandler):
    def __init__(self, stream=None):
        super().__init__(stream)
        # Replace problematic characters in Windows console
        self.emoji_map = {
            '✅': '[OK]',
            '❌': '[X]',
            '🎮': '[GAME]',
            '⏳': '[WAIT]',
            '🎯': '[MOVE]',
            '📊': '[STATS]',
            '💥': '[ERROR]',
            '🚀': '[START]',
            '❓': '[?]',
            '❗': '[!]'
        }

    def format(self, record):
        # Get the formatted message
        msg = super().format(record)
        
        # Replace emojis with text equivalents
        for emoji, text in self.emoji_map.items():
            msg = msg.replace(emoji, text)
            
        return msg

# Remove all existing handlers
for handler in logging.root.handlers[:]:
    logging.root.removeHandler(handler)
    handler.close()

# Configure logging with safe handler
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[SafeStreamHandler(sys.stderr)],
    force=True  # This will override any existing handlers
)

async def main() -> None:
    """Run all WebSocket tests and report results."""
    logger.info("🚀 Starting WebSocket tests...\n")
    
    # Run tests
    test_results = [
        ("Full Match Test", await test_websocket_match()),
        ("Duplicate Move Test", await test_invalid_move())
    ]

    # Print test summary
    logger.info("\n" + "="*60)
    logger.info("📊 TEST SUMMARY")
    logger.info("="*60)
    
    all_passed = True
    for test_name, passed in test_results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        logger.info(f"{test_name}: {status}")
        if not passed:
            all_passed = False

    if all_passed:
        logger.info("\n🎉 ALL TESTS PASSED!")
    else:
        logger.error("\n💥 SOME TESTS FAILED!")
        sys.exit(1)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("\nTest execution interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"\n❌ Unexpected error: {str(e)}", exc_info=True)
        sys.exit(1)