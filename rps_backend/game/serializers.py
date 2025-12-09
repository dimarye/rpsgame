from rest_framework import serializers
from .models import Match, Move, Round
from accounts.serializers import UserSerializer

class MoveSerializer(serializers.ModelSerializer):
    player = UserSerializer(read_only=True)
    
    class Meta:
        model = Move
        fields = ['id', 'player', 'choice', 'timestamp']
        read_only_fields = ['id', 'player', 'timestamp']

class RoundSerializer(serializers.ModelSerializer):
    move1 = MoveSerializer(read_only=True)
    move2 = MoveSerializer(read_only=True)
    winner = UserSerializer(read_only=True)
    
    class Meta:
        model = Round
        fields = ['id', 'round_number', 'move1', 'move2', 'winner', 'is_draw', 'created_at']


class MatchSerializer(serializers.ModelSerializer):
    player1 = UserSerializer(read_only=True)
    player2 = UserSerializer(read_only=True)
    winner = UserSerializer(read_only=True)
    moves = MoveSerializer(many=True, read_only=True)
    rounds = RoundSerializer(many=True, read_only=True)
    
    class Meta:
        model = Match
        fields = [
            'id', 'player1', 'player2', 'status', 'winner',
            'created_at', 'updated_at', 'moves', 'rounds', 'wins_needed'
        ]
        read_only_fields = [
            'id', 'player1', 'player2', 'status', 'winner',
            'created_at', 'updated_at', 'moves', 'rounds'
        ]

class CreateMatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Match
        fields = ['id', 'player1', 'player2', 'status', 'created_at', 'wins_needed']
        read_only_fields = ['id', 'player1', 'player2', 'status', 'created_at']
        
    def create(self, validated_data):
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            # Create a new match with the current user as player1
            wins_needed = validated_data.get('wins_needed')
            if wins_needed is None or wins_needed < 1:
                wins_needed = 3
            match = Match.objects.create(
                player1=request.user,
                status=Match.Status.PENDING,
                wins_needed=wins_needed
            )
            return match
        raise serializers.ValidationError("User must be authenticated to create a match")

class SubmitMoveSerializer(serializers.ModelSerializer):
    class Meta:
        model = Move
        fields = ['choice']
        extra_kwargs = {
            'choice': {'required': True}
        }
        
    def validate_choice(self, value):
        if value not in [choice[0] for choice in Move.Choice.choices]:
            raise serializers.ValidationError("Invalid choice. Must be one of: rock, paper, scissors")
        return value
