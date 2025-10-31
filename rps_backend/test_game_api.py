import os
import sys
import json
import requests
import django
import logging

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
from game.models import Match, Move

BASE_URL = 'http://localhost:8000/api'

def run_tests():
    logger.info("=== Starting Game API Tests ===")
    
    # Create test users
    User = get_user_model()
    try:
        # Clean up existing test data first
        logger.info("Cleaning up existing test data...")
        Match.objects.all().delete()
        Move.objects.all()
        
        # Delete existing test users to avoid unique constraint issues
        User.objects.filter(username__in=['testuser1', 'testuser2']).delete()
        
        # Create test users
        logger.info("Creating test users...")
        user1 = User.objects.create_user(
            username='testuser1',
            email='test1@example.com',
            display_name='Test User 1',
            password='testpass123'
        )
        logger.info(f"Created user: {user1.username} (ID: {user1.id})")

        user2 = User.objects.create_user(
            username='testuser2',
            email='test2@example.com',
            display_name='Test User 2',
            password='testpass123'
        )
        logger.info(f"Created user: {user2.username} (ID: {user2.id})")

        # Get tokens for both users
        logger.info("\nGetting authentication tokens...")
        token1 = get_token('testuser1', 'testpass123')
        if not token1:
            logger.error("Failed to get token for user1")
            return False
            
        token2 = get_token('testuser2', 'testpass123')
        if not token2:
            logger.error("Failed to get token for user2")
            return False

        if not token1 or not token2:
            print("❌ Failed to get auth tokens")
            return False

        # Test creating a match
        logger.info("\n=== Test 1: Create Match ===")
        match = create_match(token1)
        if not match:
            logger.error("❌ Failed to create match")
            return False

        match_id = match.get('id')
        if not match_id:
            logger.error(f"❌ Invalid match response: {match}")
            return False
            
        logger.info(f"✅ Created match with ID: {match_id}")
        
        # Verify match was created in the database
        try:
            db_match = Match.objects.get(id=match_id)
            logger.info(f"✅ Match found in database. Status: {db_match.status}")
        except Match.DoesNotExist:
            logger.error(f"❌ Match {match_id} not found in database")
            return False
        
        # Verify initial match state
        match = get_match(token1, match_id)
        print(f"Match status: {match['status']} (expected: pending)")
        print(f"Player 1: {match['player1']['username']}")
        print(f"Player 2: {match['player2']}")
        
        # Test 2: Submit first move
        print("\n=== Test 2: Submit First Move ===")
        move1 = submit_move(token1, match_id, 'rock')
        if not move1:
            print("❌ Failed to submit user 1 move")
            return False
            
        print("✅ User 1 move submitted successfully")
        
        # Check match status after first move
        match = get_match(token1, match_id)
        print(f"Match status: {match['status']} (expected: active)")
        
        # Test 3: Try submitting move for same user again (should fail)
        print("\n=== Test 3: Try Invalid Move (Same User) ===")
        invalid_move = submit_move(token1, match_id, 'paper')
        if invalid_move:
            print("❌ Should not allow same user to move twice in a row")
            return False
        print("✅ Correctly prevented same user from moving twice")
        
        # Test 4: Submit second move
        print("\n=== Test 4: Submit Second Move ===")
        move2 = submit_move(token2, match_id, 'scissors')
        if not move2:
            print("❌ Failed to submit user 2 move")
            return False
            
        print("✅ User 2 move submitted successfully")
        
        # Check final match status
        print("\n=== Test 5: Verify Match Result ===")
        match = get_match(token1, match_id)
        print(f"Match status: {match['status']} (expected: finished)")
        
        winner = match.get('winner', {})
        expected_winner = user1.username  # rock beats scissors
        print(f"Winner: {winner.get('username') if winner else 'Draw'} (expected: {expected_winner})")
        
        if winner and winner.get('username') == expected_winner:
            print("✅ Correct winner determined")
        else:
            print("❌ Incorrect winner")
            return False
            
        # Test 6: Try submitting move after match is finished
        print("\n=== Test 6: Try Move After Match End ===")
        late_move = submit_move(token1, match_id, 'paper')
        if late_move:
            print("❌ Should not allow moves after match is finished")
            return False
        print("✅ Correctly prevented moves after match end")
        
        print("\n=== All Tests Passed Successfully! ===")
        return True
        
    except Exception as e:
        print(f"❌ Error during testing: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def get_token(username, password):
    url = f'{BASE_URL}/auth/token/'
    data = {
        'username': username,
        'password': password
    }
    try:
        print(f"Authenticating user: {username}")
        response = requests.post(url, json=data)
        if response.status_code == 200:
            token = response.json().get('access')
            print(f"✅ Authentication successful")
            return token
        print(f"❌ Failed to get token: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Error getting token: {str(e)}")
    return None

def create_match(token):
    """Create a new match and return the match data if successful."""
    url = f'{BASE_URL}/matches/'
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
    
    logger.info(f"Creating new match at {url}")
    
    try:
        response = requests.post(url, headers=headers, json={})
        logger.debug(f"Response status: {response.status_code}")
        logger.debug(f"Response content: {response.text}")
        
        if response.status_code == 201:
            match_data = response.json()
            logger.info(f"✅ Match created successfully. ID: {match_data.get('id')}")
            return match_data
            
        # Handle specific error cases
        if response.status_code == 400:
            logger.error(f"❌ Bad request: {response.text}")
            if 'non_field_errors' in response.json():
                for error in response.json()['non_field_errors']:
                    logger.error(f"Validation error: {error}")
        elif response.status_code == 401:
            logger.error("❌ Authentication failed. Invalid or expired token.")
        elif response.status_code == 403:
            logger.error("❌ Permission denied. Check user permissions.")
        else:
            logger.error(f"❌ Unexpected error: {response.status_code} - {response.text}")
            
    except requests.exceptions.RequestException as e:
        logger.error(f"❌ Request failed: {str(e)}")
    except json.JSONDecodeError as e:
        logger.error(f"❌ Failed to parse JSON response: {str(e)}")
    except Exception as e:
        logger.error(f"❌ Unexpected error: {str(e)}")
        
    return None

def submit_move(token, match_id, choice):
    url = f'{BASE_URL}/matches/{match_id}/move/'
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    data = {'choice': choice}
    try:
        print(f"Submitting move: {choice}")
        response = requests.post(url, headers=headers, json=data)
        if response.status_code in [200, 201]:
            print(f"✅ Move submitted: {choice}")
            return response.json()
        print(f"❌ Failed to submit move: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Error submitting move: {str(e)}")
    return None

def get_match(token, match_id):
    url = f'{BASE_URL}/matches/{match_id}/'
    headers = {'Authorization': f'Bearer {token}'}
    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            return response.json()
        print(f"❌ Failed to get match: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Error getting match: {str(e)}")
    return None

if __name__ == "__main__":
    run_tests()
