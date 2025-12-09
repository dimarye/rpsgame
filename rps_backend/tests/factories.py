import factory
from factory import fuzzy
from django.contrib.auth import get_user_model
from django.utils import timezone
from game.models import Match, Move, Round
from game.models_matchmaking import MatchmakingQueue, BotPlayer

User = get_user_model()


class UserFactory(factory.django.DjangoModelFactory):
    """Factory for User model."""
    
    class Meta:
        model = User
    
    username = factory.Sequence(lambda n: f"user{n}")
    email = factory.LazyAttribute(lambda obj: f"{obj.username}@example.com")
    first_name = factory.Faker("first_name")
    last_name = factory.Faker("last_name")
    password = factory.PostGenerationMethodCall("set_password", "test123")
    is_active = True
    rating = fuzzy.FuzzyInteger(800, 1200)
    display_name = factory.LazyAttribute(lambda obj: f"{obj.first_name} {obj.last_name}")


class BotUserFactory(UserFactory):
    """Factory for Bot users."""
    
    is_bot = True
    bot_difficulty = fuzzy.FuzzyChoice(['easy', 'medium', 'hard'])
    rating = factory.LazyAttribute(lambda obj: {
        'easy': 800,
        'medium': 1000,
        'hard': 1200
    }[obj.bot_difficulty])


class BotPlayerFactory(factory.django.DjangoModelFactory):
    """Factory for BotPlayer model."""
    
    class Meta:
        model = BotPlayer
    
    user = factory.SubFactory(BotUserFactory)
    strategy = fuzzy.FuzzyChoice([
        BotPlayer.Strategy.RANDOM,
        BotPlayer.Strategy.COUNTER,
        BotPlayer.Strategy.PATTERN,
        BotPlayer.Strategy.ADAPTIVE
    ])
    difficulty = fuzzy.FuzzyChoice(['easy', 'medium', 'hard'])
    response_time_range = {"min": 1.0, "max": 3.0}
    win_rate = fuzzy.FuzzyFloat(0.3, 0.7)
    is_active = True


class MatchFactory(factory.django.DjangoModelFactory):
    """Factory for Match model."""
    
    class Meta:
        model = Match
    
    player1 = factory.SubFactory(UserFactory)
    player2 = factory.SubFactory(UserFactory)
    status = fuzzy.FuzzyChoice([
        Match.Status.PENDING,
        Match.Status.ACTIVE,
        Match.Status.FINISHED
    ])
    winner = factory.Maybe(
        fuzzy.FuzzyChoice([True, False]),
        yes_declaration = factory.SubFactory(UserFactory),
        no_declaration = None
    )
    wins_needed = fuzzy.FuzzyInteger(1, 3)


class PendingMatchFactory(MatchFactory):
    """Factory for pending matches (no player2)."""
    
    player2 = None
    status = Match.Status.PENDING


class ActiveMatchFactory(MatchFactory):
    """Factory for active matches."""
    
    status = Match.Status.ACTIVE
    winner = None


class FinishedMatchFactory(MatchFactory):
    """Factory for finished matches."""
    
    status = Match.Status.FINISHED
    winner = factory.SelfAttribute('player1')


class MoveFactory(factory.django.DjangoModelFactory):
    """Factory for Move model."""
    
    class Meta:
        model = Move
    
    match = factory.SubFactory(MatchFactory)
    player = factory.SubFactory(UserFactory)
    choice = fuzzy.FuzzyChoice([
        Move.Choice.ROCK,
        Move.Choice.PAPER,
        Move.Choice.SCISSORS
    ])
    timestamp = factory.LazyFunction(timezone.now)


class RoundFactory(factory.django.DjangoModelFactory):
    """Factory for Round model."""
    
    class Meta:
        model = Round
    
    match = factory.SubFactory(MatchFactory)
    round_number = fuzzy.FuzzyInteger(1, 5)
    winner = factory.Maybe(
        fuzzy.FuzzyChoice([True, False]),
        yes_declaration = lambda n: factory.SubFactory(UserFactory),
        no_declaration = None
    )
    is_draw = fuzzy.FuzzyChoice([True, False])
    
    @factory.post_generation
    def create_moves(obj, create, extracted, **kwargs):
        """Create moves for the round."""
        if not create:
            return
        
        # Create moves for both players if match has player2
        if obj.match.player2:
            MoveFactory.create(
                match=obj.match,
                player=obj.match.player1,
                choice=fuzzy.FuzzyChoice(['rock', 'paper', 'scissors'])
            )
            MoveFactory.create(
                match=obj.match,
                player=obj.match.player2,
                choice=fuzzy.FuzzyChoice(['rock', 'paper', 'scissors'])
            )


class MatchmakingQueueFactory(factory.django.DjangoModelFactory):
    """Factory for MatchmakingQueue model."""
    
    class Meta:
        model = MatchmakingQueue
    
    player = factory.SubFactory(UserFactory)
    status = fuzzy.FuzzyChoice([
        MatchmakingQueue.Status.WAITING,
        MatchmakingQueue.Status.MATCHED,
        MatchmakingQueue.Status.CANCELLED
    ])
    preferred_difficulty = fuzzy.FuzzyChoice(['any', 'easy', 'medium', 'hard'])
    allow_bots = True
    match = factory.Maybe(
        fuzzy.FuzzyChoice([True, False]),
        yes_declaration = lambda n: factory.SubFactory(MatchFactory),
        no_declaration = None
    )
    
    @factory.post_generation
    def set_matched_timestamp(obj, create, extracted, **kwargs):
        """Set matched_at timestamp when status is MATCHED."""
        if obj.status == MatchmakingQueue.Status.MATCHED:
            obj.matched_at = timezone.now()
            obj.save()
