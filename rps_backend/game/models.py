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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Match {self.id} - {self.status}'

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'matches'


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
