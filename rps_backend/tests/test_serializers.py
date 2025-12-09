import pytest
from django.test import TestCase
from rest_framework import serializers
from accounts.serializers import UserSerializer, UserRegistrationSerializer, CustomTokenObtainPairSerializer
from game.serializers import MatchSerializer, MoveSerializer, RoundSerializer
from tests.factories import UserFactory, MatchFactory, MoveFactory, RoundFactory


class UserSerializerTest(TestCase):
    """Test cases for UserSerializer."""
    
    def setUp(self):
        self.user = UserFactory.create()
        self.serializer = UserSerializer(instance=self.user)
    
    def test_contains_expected_fields(self):
        """Test that serializer contains expected fields."""
        data = self.serializer.data
        expected_fields = {
            'id', 'username', 'email', 'first_name', 'last_name',
            'display_name', 'rating', 'avatar', 'is_bot', 'bot_difficulty'
        }
        self.assertEqual(set(data.keys()), expected_fields)
    
    def test_username_field_content(self):
        """Test username field content."""
        data = self.serializer.data
        self.assertEqual(data['username'], self.user.username)
    
    def test_rating_field_content(self):
        """Test rating field content."""
        data = self.serializer.data
        self.assertEqual(data['rating'], self.user.rating)
    
    def test_bot_fields_content(self):
        """Test bot-related fields."""
        data = self.serializer.data
        self.assertEqual(data['is_bot'], self.user.is_bot)
        self.assertEqual(data['bot_difficulty'], self.user.bot_difficulty)


class UserRegistrationSerializerTest(TestCase):
    """Test cases for UserRegistrationSerializer."""
    
    def test_valid_registration_data(self):
        """Test serializer with valid data."""
        data = {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': 'test123456',
            'password_confirm': 'test123456',
            'first_name': 'Test',
            'last_name': 'User'
        }
        serializer = UserRegistrationSerializer(data=data)
        self.assertTrue(serializer.is_valid())
    
    def test_password_mismatch(self):
        """Test serializer with password mismatch."""
        data = {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': 'test123456',
            'password_confirm': 'different123',
            'first_name': 'Test',
            'last_name': 'User'
        }
        serializer = UserRegistrationSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('password_confirm', serializer.errors)
    
    def test_duplicate_username(self):
        """Test serializer with duplicate username."""
        existing_user = UserFactory.create(username='existinguser')
        
        data = {
            'username': 'existinguser',
            'email': 'new@example.com',
            'password': 'test123456',
            'password_confirm': 'test123456'
        }
        serializer = UserRegistrationSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('username', serializer.errors)
    
    def test_duplicate_email(self):
        """Test serializer with duplicate email."""
        existing_user = UserFactory.create(email='existing@example.com')
        
        data = {
            'username': 'newuser',
            'email': 'existing@example.com',
            'password': 'test123456',
            'password_confirm': 'test123456'
        }
        serializer = UserRegistrationSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('email', serializer.errors)
    
    def test_missing_required_fields(self):
        """Test serializer with missing required fields."""
        data = {
            'username': 'testuser'
            # Missing email, password, password_confirm
        }
        serializer = UserRegistrationSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('email', serializer.errors)
        self.assertIn('password', serializer.errors)
        self.assertIn('password_confirm', serializer.errors)
    
    def test_create_user(self):
        """Test user creation through serializer."""
        data = {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': 'test123456',
            'password_confirm': 'test123456',
            'first_name': 'Test',
            'last_name': 'User'
        }
        serializer = UserRegistrationSerializer(data=data)
        self.assertTrue(serializer.is_valid())
        
        user = serializer.save()
        self.assertEqual(user.username, 'newuser')
        self.assertEqual(user.email, 'newuser@example.com')
        self.assertTrue(user.check_password('test123456'))


class CustomTokenObtainPairSerializerTest(TestCase):
    """Test cases for CustomTokenObtainPairSerializer."""
    
    def setUp(self):
        self.user = UserFactory.create()
    
    def test_valid_credentials(self):
        """Test serializer with valid credentials."""
        data = {
            'username': self.user.username,
            'password': 'test123'
        }
        serializer = CustomTokenObtainPairSerializer(data=data)
        self.assertTrue(serializer.is_valid())
    
    def test_invalid_password(self):
        """Test serializer with invalid password."""
        data = {
            'username': self.user.username,
            'password': 'wrongpassword'
        }
        serializer = CustomTokenObtainPairSerializer(data=data)
        self.assertFalse(serializer.is_valid())
    
    def test_invalid_username(self):
        """Test serializer with invalid username."""
        data = {
            'username': 'nonexistentuser',
            'password': 'test123'
        }
        serializer = CustomTokenObtainPairSerializer(data=data)
        self.assertFalse(serializer.is_valid())
    
    def test_missing_credentials(self):
        """Test serializer with missing credentials."""
        data = {}
        serializer = CustomTokenObtainPairSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('username', serializer.errors)
        self.assertIn('password', serializer.errors)


class MatchSerializerTest(TestCase):
    """Test cases for MatchSerializer."""
    
    def setUp(self):
        self.match = MatchFactory.create()
        self.serializer = MatchSerializer(instance=self.match)
    
    def test_contains_expected_fields(self):
        """Test that serializer contains expected fields."""
        data = self.serializer.data
        expected_fields = {
            'id', 'player1', 'player2', 'status', 'winner',
            'wins_needed', 'created_at', 'updated_at'
        }
        self.assertEqual(set(data.keys()), expected_fields)
    
    def test_status_field_content(self):
        """Test status field content."""
        data = self.serializer.data
        self.assertEqual(data['status'], self.match.status)
    
    def test_player_fields_content(self):
        """Test player fields content."""
        data = self.serializer.data
        self.assertEqual(data['player1']['id'], self.match.player1.id)
        if self.match.player2:
            self.assertEqual(data['player2']['id'], self.match.player2.id)
    
    def test_pending_match_serialization(self):
        """Test serialization of pending match."""
        pending_match = MatchFactory.create(status='pending', player2=None)
        serializer = MatchSerializer(instance=pending_match)
        data = serializer.data
        self.assertEqual(data['status'], 'pending')
        self.assertIsNone(data['player2'])


class MoveSerializerTest(TestCase):
    """Test cases for MoveSerializer."""
    
    def setUp(self):
        self.move = MoveFactory.create()
        self.serializer = MoveSerializer(instance=self.move)
    
    def test_contains_expected_fields(self):
        """Test that serializer contains expected fields."""
        data = self.serializer.data
        expected_fields = {'id', 'match', 'player', 'choice', 'timestamp'}
        self.assertEqual(set(data.keys()), expected_fields)
    
    def test_choice_field_content(self):
        """Test choice field content."""
        data = self.serializer.data
        self.assertEqual(data['choice'], self.move.choice)
    
    def test_invalid_choice(self):
        """Test serializer with invalid choice."""
        data = {
            'match': self.move.match.id,
            'player': self.move.player.id,
            'choice': 'invalid_choice'
        }
        serializer = MoveSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('choice', serializer.errors)
    
    def test_valid_choices(self):
        """Test serializer with valid choices."""
        valid_choices = ['rock', 'paper', 'scissors']
        
        for choice in valid_choices:
            data = {
                'match': self.move.match.id,
                'player': self.move.player.id,
                'choice': choice
            }
            serializer = MoveSerializer(data=data)
            self.assertTrue(serializer.is_valid(), f"Choice {choice} should be valid")


class RoundSerializerTest(TestCase):
    """Test cases for RoundSerializer."""
    
    def setUp(self):
        self.round = RoundFactory.create()
        self.serializer = RoundSerializer(instance=self.round)
    
    def test_contains_expected_fields(self):
        """Test that serializer contains expected fields."""
        data = self.serializer.data
        expected_fields = {
            'id', 'match', 'round_number', 'move1', 'move2',
            'winner', 'is_draw', 'created_at'
        }
        self.assertEqual(set(data.keys()), expected_fields)
    
    def test_round_number_field_content(self):
        """Test round_number field content."""
        data = self.serializer.data
        self.assertEqual(data['round_number'], self.round.round_number)
    
    def test_is_draw_field_content(self):
        """Test is_draw field content."""
        data = self.serializer.data
        self.assertEqual(data['is_draw'], self.round.is_draw)
    
    def test_winner_field_content(self):
        """Test winner field content."""
        data = self.serializer.data
        if self.round.winner:
            self.assertEqual(data['winner']['id'], self.round.winner.id)
        else:
            self.assertIsNone(data['winner'])
