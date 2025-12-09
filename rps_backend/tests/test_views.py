import pytest
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from tests.factories import UserFactory, MatchFactory, MoveFactory, BotPlayerFactory

User = get_user_model()


class UserRegistrationViewTest(TestCase):
    """Test cases for user registration view."""
    
    def setUp(self):
        self.client = APIClient()
        self.url = reverse('register')
    
    def test_register_user_success(self):
        """Test successful user registration."""
        data = {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': 'test123456',
            'password_confirm': 'test123456',
            'first_name': 'Test',
            'last_name': 'User'
        }
        
        response = self.client.post(self.url, data)
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('id', response.data)
        self.assertEqual(response.data['username'], 'newuser')
        self.assertEqual(response.data['email'], 'newuser@example.com')
    
    def test_register_user_password_mismatch(self):
        """Test registration with password mismatch."""
        data = {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': 'test123456',
            'password_confirm': 'different123',
            'first_name': 'Test',
            'last_name': 'User'
        }
        
        response = self.client.post(self.url, data)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password_confirm', response.data)
    
    def test_register_user_duplicate_username(self):
        """Test registration with duplicate username."""
        UserFactory.create(username='existinguser')
        
        data = {
            'username': 'existinguser',
            'email': 'new@example.com',
            'password': 'test123456',
            'password_confirm': 'test123456'
        }
        
        response = self.client.post(self.url, data)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('username', response.data)


class UserDetailViewTest(TestCase):
    """Test cases for user detail view."""
    
    def setUp(self):
        self.client = APIClient()
        self.user = UserFactory.create()
        self.url = reverse('user_detail')
        self.token = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token.access_token}')
    
    def test_get_user_detail_success(self):
        """Test successful user detail retrieval."""
        response = self.client.get(self.url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], self.user.id)
        self.assertEqual(response.data['username'], self.user.username)
    
    def test_get_user_detail_unauthorized(self):
        """Test user detail retrieval without authentication."""
        self.client.credentials()  # Remove authentication
        response = self.client.get(self.url)
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_get_user_detail_invalid_token(self):
        """Test user detail retrieval with invalid token."""
        self.client.credentials(HTTP_AUTHORIZATION='Bearer invalid_token')
        response = self.client.get(self.url)
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class TokenObtainViewTest(TestCase):
    """Test cases for token obtain view."""
    
    def setUp(self):
        self.client = APIClient()
        self.user = UserFactory.create()
        self.url = reverse('token_obtain_pair')
    
    def test_obtain_token_success(self):
        """Test successful token obtain."""
        data = {
            'email': self.user.email,
            'password': 'test123'
        }
        
        response = self.client.post(self.url, data)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
    
    def test_obtain_token_invalid_credentials(self):
        """Test token obtain with invalid credentials."""
        data = {
            'email': self.user.email,
            'password': 'wrongpassword'
        }
        
        response = self.client.post(self.url, data)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_obtain_token_missing_fields(self):
        """Test token obtain with missing fields."""
        data = {
            'email': self.user.email
            # Missing password
        }
        
        response = self.client.post(self.url, data)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', response.data)


class MatchListViewTest(TestCase):
    """Test cases for match list view."""
    
    def setUp(self):
        self.client = APIClient()
        self.user = UserFactory.create()
        self.url = reverse('match-list')
        self.token = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token.access_token}')
        
        # Create test matches
        self.matches = MatchFactory.create_batch(5)
    
    def test_get_match_list_success(self):
        """Test successful match list retrieval."""
        response = self.client.get(self.url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 5)
    
    def test_get_match_list_unauthorized(self):
        """Test match list retrieval without authentication."""
        self.client.credentials()  # Remove authentication
        response = self.client.get(self.url)
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_get_match_list_filtered_by_status(self):
        """Test match list filtered by status."""
        # Create matches with specific status
        active_matches = MatchFactory.create_batch(3, status='active')
        
        response = self.client.get(self.url, {'status': 'active'})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should include active matches from setup and created ones
        self.assertGreaterEqual(len(response.data), 3)


class MatchDetailViewTest(TestCase):
    """Test cases for match detail view."""
    
    def setUp(self):
        self.client = APIClient()
        self.user = UserFactory.create()
        self.match = MatchFactory.create(player1=self.user)
        self.url = reverse('match-detail', kwargs={'pk': self.match.pk})
        self.token = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token.access_token}')
    
    def test_get_match_detail_success(self):
        """Test successful match detail retrieval."""
        response = self.client.get(self.url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], self.match.id)
        self.assertEqual(response.data['player1']['id'], self.user.id)
    
    def test_get_match_detail_not_found(self):
        """Test match detail retrieval for non-existent match."""
        url = reverse('match-detail', kwargs={'pk': 99999})
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_get_match_detail_unauthorized(self):
        """Test match detail retrieval without authentication."""
        self.client.credentials()  # Remove authentication
        response = self.client.get(self.url)
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class JoinMatchViewTest(TestCase):
    """Test cases for join match view."""
    
    def setUp(self):
        self.client = APIClient()
        self.user = UserFactory.create()
        self.match = MatchFactory.create(player2=None, status='pending')
        self.url = reverse('join-match', kwargs={'pk': self.match.pk})
        self.token = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token.access_token}')
    
    def test_join_match_success(self):
        """Test successful match join."""
        response = self.client.post(self.url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.match.refresh_from_db()
        self.assertEqual(self.match.player2, self.user)
        self.assertEqual(self.match.status, 'active')
    
    def test_join_match_already_full(self):
        """Test joining a match that's already full."""
        # Make match full
        self.match.player2 = UserFactory.create()
        self.match.save()
        
        response = self.client.post(self.url)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_join_match_not_pending(self):
        """Test joining a match that's not pending."""
        self.match.status = 'active'
        self.match.save()
        
        response = self.client.post(self.url)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_join_match_unauthorized(self):
        """Test match join without authentication."""
        self.client.credentials()  # Remove authentication
        response = self.client.post(self.url)
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class SubmitMoveViewTest(TestCase):
    """Test cases for submit move view."""
    
    def setUp(self):
        self.client = APIClient()
        self.user = UserFactory.create()
        self.match = MatchFactory.create(player1=self.user, status='active')
        self.url = reverse('submit-move', kwargs={'pk': self.match.pk})
        self.token = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token.access_token}')
    
    def test_submit_move_success(self):
        """Test successful move submission."""
        data = {'choice': 'rock'}
        
        response = self.client.post(self.url, data)
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['choice'], 'rock')
        self.assertEqual(response.data['player'], self.user.id)
    
    def test_submit_move_invalid_choice(self):
        """Test move submission with invalid choice."""
        data = {'choice': 'invalid_choice'}
        
        response = self.client.post(self.url, data)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('choice', response.data)
    
    def test_submit_move_inactive_match(self):
        """Test move submission to inactive match."""
        self.match.status = 'pending'
        self.match.save()
        
        data = {'choice': 'rock'}
        response = self.client.post(self.url, data)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_submit_move_unauthorized(self):
        """Test move submission without authentication."""
        self.client.credentials()  # Remove authentication
        data = {'choice': 'rock'}
        response = self.client.post(self.url, data)
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class MatchmakingViewTest(TestCase):
    """Test cases for matchmaking view."""
    
    def setUp(self):
        self.client = APIClient()
        self.user = UserFactory.create()
        self.url = reverse('matchmaking')
        self.token = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token.access_token}')
    
    def test_join_matchmaking_success(self):
        """Test successful matchmaking join."""
        data = {
            'preferred_difficulty': 'medium',
            'allow_bots': True
        }
        
        response = self.client.post(self.url, data)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('queue_id', response.data)
        self.assertEqual(response.data['status'], 'waiting')
    
    def test_leave_matchmaking_success(self):
        """Test successful matchmaking leave."""
        # First join matchmaking
        self.client.post(self.url, {'allow_bots': True})
        
        # Then leave
        response = self.client.delete(self.url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('message', response.data)
    
    def test_get_matchmaking_status_success(self):
        """Test successful matchmaking status retrieval."""
        # First join matchmaking
        self.client.post(self.url, {'allow_bots': True})
        
        # Then get status
        response = self.client.get(self.url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['in_queue'])
    
    def test_matchmaking_unauthorized(self):
        """Test matchmaking operations without authentication."""
        self.client.credentials()  # Remove authentication
        
        response = self.client.post(self.url, {'allow_bots': True})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        
        response = self.client.delete(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
