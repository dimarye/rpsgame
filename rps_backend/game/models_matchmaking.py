from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
import uuid

User = get_user_model()

class MatchmakingQueue(models.Model):
    """Represents a player in the matchmaking queue."""
    
    class Status(models.TextChoices):
        WAITING = 'waiting', 'Waiting'
        MATCHED = 'matched', 'Matched'
        CANCELLED = 'cancelled', 'Cancelled'
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    player = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='queue_entries'
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.WAITING
    )
    created_at = models.DateTimeField(auto_now_add=True)
    matched_at = models.DateTimeField(null=True, blank=True)
    match = models.ForeignKey(
        'Match',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='queue_matches'
    )
    
    # Matchmaking preferences
    preferred_difficulty = models.CharField(
        max_length=20,
        choices=[
            ('any', 'Any'),
            ('easy', 'Easy'),
            ('medium', 'Medium'),
            ('hard', 'Hard'),
        ],
        default='any',
        help_text='Preferred bot difficulty if matched with bot'
    )
    allow_bots = models.BooleanField(
        default=True,
        help_text='Allow matching with bot players'
    )
    
    class Meta:
        ordering = ['created_at']
        verbose_name = 'Matchmaking Queue Entry'
        verbose_name_plural = 'Matchmaking Queue Entries'
    
    def __str__(self):
        return f'{self.player.username} - {self.status}'
    
    def mark_as_matched(self, match):
        """Mark this queue entry as matched with a game."""
        self.status = self.Status.MATCHED
        self.matched_at = timezone.now()
        self.match = match
        self.save()


class BotPlayer(models.Model):
    """AI bot player configuration and logic."""
    
    class Strategy(models.TextChoices):
        RANDOM = 'random', 'Random'
        COUNTER = 'counter', 'Counter Strategy'
        PATTERN = 'pattern', 'Pattern Based'
        ADAPTIVE = 'adaptive', 'Adaptive'
    
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='bot_profile'
    )
    strategy = models.CharField(
        max_length=20,
        choices=Strategy.choices,
        default=Strategy.RANDOM
    )
    difficulty = models.CharField(
        max_length=20,
        choices=[
            ('easy', 'Easy'),
            ('medium', 'Medium'),
            ('hard', 'Hard'),
        ],
        default='medium'
    )
    response_time_range = models.JSONField(
        default=dict,
        help_text='Min/max response time in seconds: {"min": 1.0, "max": 3.0}'
    )
    win_rate = models.FloatField(
        default=0.5,
        help_text='Target win rate for adaptive strategy (0.0-1.0)'
    )
    is_active = models.BooleanField(
        default=True,
        help_text='Whether this bot is available for matchmaking'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    last_active = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Bot Player'
        verbose_name_plural = 'Bot Players'
    
    def __str__(self):
        return f'Bot {self.user.username} ({self.difficulty})'
    
    def get_move_choice(self, opponent_history=None):
        """Get bot's move choice based on strategy."""
        from game.models import Move
        
        if self.strategy == self.Strategy.RANDOM:
            return self._random_choice()
        elif self.strategy == self.Strategy.COUNTER:
            return self._counter_choice(opponent_history)
        elif self.strategy == self.Strategy.PATTERN:
            return self._pattern_choice(opponent_history)
        elif self.strategy == self.Strategy.ADAPTIVE:
            return self._adaptive_choice(opponent_history)
        else:
            return self._random_choice()
    
    def _random_choice(self):
        """Random move selection."""
        import random
        return random.choice(['rock', 'paper', 'scissors'])
    
    def _counter_choice(self, opponent_history):
        """Try to counter opponent's most frequent move."""
        if not opponent_history:
            return self._random_choice()
        
        # Count opponent's moves
        move_counts = {'rock': 0, 'paper': 0, 'scissors': 0}
        for move in opponent_history[-5:]:  # Last 5 moves
            move_counts[move] = move_counts.get(move, 0) + 1
        
        # Find most frequent move
        most_frequent = max(move_counts, key=move_counts.get)
        
        # Counter it
        counters = {'rock': 'paper', 'paper': 'scissors', 'scissors': 'rock'}
        return counters[most_frequent]
    
    def _pattern_choice(self, opponent_history):
        """Try to detect and counter patterns."""
        if len(opponent_history) < 3:
            return self._random_choice()
        
        # Simple pattern detection: look for last 2 moves pattern
        last_two = tuple(opponent_history[-2:])
        
        # If we've seen this pattern before, predict next move
        pattern_predictions = {
            ('rock', 'rock'): 'paper',
            ('rock', 'paper'): 'scissors',
            ('rock', 'scissors'): 'rock',
            ('paper', 'rock'): 'scissors',
            ('paper', 'paper'): 'rock',
            ('paper', 'scissors'): 'paper',
            ('scissors', 'rock'): 'paper',
            ('scissors', 'paper'): 'rock',
            ('scissors', 'scissors'): 'scissors',
        }
        
        return pattern_predictions.get(last_two, self._random_choice())
    
    def _adaptive_choice(self, opponent_history):
        """Adaptive strategy based on win rate."""
        import random
        
        if not opponent_history or random.random() > 0.7:
            return self._random_choice()
        
        # Mix of strategies based on difficulty
        if self.difficulty == 'easy':
            # 70% random, 30% counter
            return self._counter_choice(opponent_history) if random.random() > 0.7 else self._random_choice()
        elif self.difficulty == 'medium':
            # 50% random, 50% counter
            return self._counter_choice(opponent_history) if random.random() > 0.5 else self._random_choice()
        else:  # hard
            # 30% random, 70% pattern
            return self._pattern_choice(opponent_history) if random.random() > 0.3 else self._random_choice()
