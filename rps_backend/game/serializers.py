from rest_framework import serializers
from .models import Match, Move
from accounts.serializers import UserSerializer

class MoveSerializer(serializers.ModelSerializer):
    player = UserSerializer(read_only=True)
    
    class Meta:
        model = Move
        fields = ['id', 'player', 'choice', 'timestamp']
        read_only_fields = ['id', 'player', 'timestamp']

class MatchSerializer(serializers.ModelSerializer):
    player1 = UserSerializer(read_only=True)
    player2 = UserSerializer(read_only=True)
    winner = UserSerializer(read_only=True)
    moves = MoveSerializer(many=True, read_only=True)
    
    class Meta:
        model = Match
        fields = [
            'id', 'player1', 'player2', 'status', 'winner',
            'created_at', 'updated_at', 'moves'
        ]
        read_only_fields = [
            'id', 'player1', 'player2', 'status', 'winner',
            'created_at', 'updated_at', 'moves'
        ]

class CreateMatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Match
        fields = ['id', 'player1', 'player2', 'status', 'created_at']
        read_only_fields = ['id', 'player1', 'player2', 'status', 'created_at']
        
    def create(self, validated_data):
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            # Create a new match with the current user as player1
            match = Match.objects.create(
                player1=request.user,
                status=Match.Status.PENDING
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
