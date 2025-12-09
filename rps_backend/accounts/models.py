from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils.translation import gettext_lazy as _

class CustomUser(AbstractUser):
    """Custom user model with additional fields."""
    
    display_name = models.CharField(
        _('display name'),
        max_length=50,
        blank=True,
        help_text=_('The name displayed to other users.')
    )
    
    rating = models.IntegerField(
        _('rating'),
        default=1000,
        help_text=_('Player rating for matchmaking')
    )
    
    avatar = models.URLField(
        _('avatar'),
        blank=True,
        help_text=_('URL to the user\'s avatar image')
    )
    
    is_bot = models.BooleanField(
        _('is bot'),
        default=False,
        help_text=_('Whether this user is a bot player')
    )
    
    bot_difficulty = models.CharField(
        _('bot difficulty'),
        max_length=20,
        choices=[
            ('easy', 'Easy'),
            ('medium', 'Medium'),
            ('hard', 'Hard'),
        ],
        blank=True,
        help_text=_('Bot difficulty level for AI players')
    )
    
    def __str__(self):
        return self.username
    
    class Meta:
        verbose_name = _('user')
        verbose_name_plural = _('users')
