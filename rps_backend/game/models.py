from django.db import models
from django.conf import settings
from django.utils import timezone

class Match(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        ACTIVE = 'active', 'Active'
        FINISHED = 'finished', 'Finished'
    
    player1 = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='matches_as_player1'
    )
    player2 = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='matches_as_player2'
    )
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.PENDING
    )
    winner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='matches_won'
    )
    wins_needed = models.PositiveSmallIntegerField(default=3)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Match {self.id} - {self.status}'

    def get_current_round_number(self):
        """Get the current round number (1-based)."""
        return self.rounds.count() + 1

    def get_player_wins(self, player):
        """Get the number of rounds won by a player."""
        return self.rounds.filter(winner=player, is_draw=False).count()

    def is_match_complete(self):
        """Check if the match is complete (someone reached wins_needed)."""
        # Check wins for both players based on recorded rounds
        player1_wins = self.get_player_wins(self.player1)
        player2_wins = self.get_player_wins(self.player2) if self.player2 else 0

        # For best-of-1 matches, match is complete as soon as someone wins a round
        if self.wins_needed <= 1:
            return (player1_wins + player2_wins) > 0

        # For longer matches, require reaching wins_needed
        return player1_wins >= self.wins_needed or player2_wins >= self.wins_needed

    def get_match_winner(self):
        """Get the overall match winner."""
        if not self.is_match_complete():
            return None
        
        player1_wins = self.get_player_wins(self.player1)
        player2_wins = self.get_player_wins(self.player2) if self.player2 else 0
        
        if player1_wins > player2_wins:
            return self.player1
        elif player2_wins > player1_wins:
            return self.player2
        return None  # Draw

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'matches'


class Round(models.Model):
    match = models.ForeignKey(
        Match,
        on_delete=models.CASCADE,
        related_name='rounds'
    )
    round_number = models.PositiveSmallIntegerField()
    move1 = models.ForeignKey(
        'Move',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='round_as_move1'
    )
    move2 = models.ForeignKey(
        'Move',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='round_as_move2'
    )
    winner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='rounds_won'
    )
    is_draw = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['round_number']
        unique_together = ['match', 'round_number']

    def __str__(self):
        return f'Round {self.round_number} of Match {self.match.id}'


class Move(models.Model):
    class Choice(models.TextChoices):
        ROCK = 'rock', 'Rock'
        PAPER = 'paper', 'Paper'
        SCISSORS = 'scissors', 'Scissors'

    match = models.ForeignKey(
        Match,
        on_delete=models.CASCADE,
        related_name='moves'
    )
    player = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='moves'
    )
    choice = models.CharField(
        max_length=10,
        choices=Choice.choices
    )
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.player.username} played {self.choice} in match {self.match.id}'

    class Meta:
        ordering = ['-timestamp']
