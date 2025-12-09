from django.db import models
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Match, Move, Round


def determine_winner(move1, move2):
    """
    Determine the winner between two moves in Rock-Paper-Scissors.
    Returns the winning move or None if it's a draw.
    """
    # Define the winning conditions
    win_conditions = {
        'rock': 'scissors',     # Rock beats scissors
        'paper': 'rock',        # Paper beats rock
        'scissors': 'paper'     # Scissors beat paper
    }
    
    # If both moves are the same, it's a draw
    if move1.choice == move2.choice:
        return None
    
    # Check if move1 beats move2
    if win_conditions[move1.choice] == move2.choice:
        return move1
    
    # Otherwise, move2 beats move1
    return move2


from .serializers import (
    MatchSerializer, CreateMatchSerializer,
    MoveSerializer, SubmitMoveSerializer
)
from accounts.models import CustomUser


class MatchListView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CreateMatchSerializer
        return MatchSerializer
    
    def get_serializer_context(self):
        """
        Extra context provided to the serializer class.
        """
        context = super().get_serializer_context()
        context.update({
            'request': self.request
        })
        return context
    
    def get_queryset(self):
        # Show all matches that are waiting for a second player
        # or where the current user is a player
        return Match.objects.filter(
            models.Q(status=Match.Status.PENDING) |  # Show all pending matches
            models.Q(player1=self.request.user) |    # Or where user is player1
            models.Q(player2=self.request.user)      # Or where user is player2
        ).order_by('-created_at')
    
    def create(self, request, *args, **kwargs):
        """
        Create a new match.
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        
        # Get the full match data using MatchSerializer
        match = serializer.instance
        response_serializer = MatchSerializer(match, context=self.get_serializer_context())
        
        headers = self.get_success_headers(response_serializer.data)
        return Response(
            response_serializer.data,
            status=status.HTTP_201_CREATED,
            headers=headers
        )
    
    def perform_create(self, serializer):
        """
        Save the match with the current user as player1.
        """
        serializer.save(player1=self.request.user, status=Match.Status.PENDING)


class MatchDetailView(generics.RetrieveAPIView):
    """
    API endpoint that allows users to retrieve match details.
    Both player1 and player2 can view the match details.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = MatchSerializer
    lookup_field = 'pk'
    
    def get_queryset(self):
        """
        Return matches where the current user is either player1 or player2.
        """
        return Match.objects.filter(
            models.Q(player1=self.request.user) | 
            models.Q(player2=self.request.user) |
            models.Q(status=Match.Status.PENDING)  # Allow viewing pending matches to join
        ).distinct()
        
    def get_object(self):
        """
        Get the match object and log access attempts.
        """
        queryset = self.filter_queryset(self.get_queryset())
        obj = get_object_or_404(queryset, pk=self.kwargs['pk'])
        
        # Log access attempt
        print(f"User {self.request.user.username} accessed match {obj.id} (status: {obj.status})")
        print(f"Player1: {obj.player1.username if obj.player1 else 'None'}, "
              f"Player2: {obj.player2.username if obj.player2 else 'None'}")
        
        # Check if this is a pending match that the user can join
        # Only allow a different user than player1 to join as player2
        if obj.status == Match.Status.PENDING and not obj.player2 and self.request.user != obj.player1:
            print(f"User {self.request.user.username} is joining match {obj.id} as player2")
            obj.player2 = self.request.user
            obj.status = Match.Status.ACTIVE
            obj.save(update_fields=['player2', 'status', 'updated_at'])
            
        return obj


class JoinMatchView(APIView):
    """
    API endpoint for joining a match.
    Allows a user to join an existing match that has an available slot.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        match = get_object_or_404(Match, pk=pk)
        user = request.user
        
        # Check if user is already in the match
        if match.player1 == user or match.player2 == user:
            return Response(
                {"detail": "You are already in this match"},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Prevent joining your own match
        if match.player1 == user or (match.player2 and match.player2 == user):
            return Response(
                {"detail": "You cannot join your own match"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if there's an available slot
        if match.player1 and match.player2:
            return Response(
                {"detail": "Match is already full"},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Check if match is in pending status
        if match.status != Match.Status.PENDING:
            return Response(
                {"detail": "This match is not available for joining"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Join the match
        if not match.player1:
            match.player1 = user
        else:
            match.player2 = user
        
        # Update match status if both players have joined
        if match.player1 and match.player2:
            match.status = Match.Status.ACTIVE
            
        match.save(update_fields=['player1', 'player2', 'status', 'updated_at'])
        
        # Notify both players via WebSocket (if implemented)
        # You would typically call a WebSocket consumer here to notify both players
        
        serializer = MatchSerializer(match, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class SubmitMoveView(APIView):
    """
    API endpoint for submitting moves in a match.
    Handles move validation, turn management, and game state updates.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        """
        Submit a move for the specified match.
        """
        # Log the move attempt
        print(f"\n=== Move Submission Attempt ===")
        print(f"User: {request.user.username} (ID: {request.user.id})")
        print(f"Match ID: {pk}")
        print(f"Data: {request.data}")
        
        try:
            # Get the match with proper permissions
            match = get_object_or_404(Match, pk=pk)
            
            print(f"\n=== Current Match State ===")
            print(f"Match ID: {match.id}")
            print(f"Status: {match.status}")
            print(f"Player1: {match.player1.username if match.player1 else 'None'}")
            print(f"Player2: {match.player2.username if match.player2 else 'None'}")
            
            # Check if the match is in a valid state for moves
            if match.status == Match.Status.FINISHED:
                print(f"❌ Match {match.id} is already finished")
                return Response(
                    {"error": "This match has already ended"},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            # Handle player joining the match (only for non-player1 users)
            # Allow joining if match is PENDING or ACTIVE (but player2 is still None)
            if not match.player2 and request.user != match.player1 and match.status in [Match.Status.PENDING, Match.Status.ACTIVE]:
                # Second player is joining
                print(f"👋 {request.user.username} is joining as player2")
                match.player2 = request.user
                match.status = Match.Status.ACTIVE
                match.save(update_fields=['player2', 'status', 'updated_at'])
                print(f"✅ Player2 assigned. Status: {match.status}")
            
            # Verify the user is a player in this match
            if request.user not in [match.player1, match.player2]:
                print(f"❌ {request.user.username} is not a player in this match")
                return Response(
                    {"error": "You are not a player in this match"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Check if it's the player's turn
            last_move = match.moves.order_by('-timestamp').first()
            if last_move:
                print(f"Last move: {last_move.player.username} played {last_move.choice}")
                if last_move.player == request.user:
                    print(f"❌ {request.user.username} tried to move twice in a row")
                    return Response(
                        {"error": "It's not your turn"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            # Validate the move
            serializer = SubmitMoveSerializer(data=request.data, context={'request': request})
            if not serializer.is_valid():
                print(f"❌ Invalid move data: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
            # Create the move
            move = serializer.save(match=match, player=request.user)
            print(f"✅ Move created: {move.choice} by {move.player.username}")
            
            # If this is player1's first move and match is still PENDING, make it ACTIVE
            if match.status == Match.Status.PENDING and request.user == match.player1:
                match.status = Match.Status.ACTIVE
                match.save(update_fields=['status', 'updated_at'])
                print(f"✅ Match status updated to ACTIVE")
            
            # Check if the game should end
            moves = list(match.moves.all())
            print(f"Total moves: {len(moves)}")
            
            # Check if we have 2 moves for the current round
            if len(moves) % 2 == 0 and len(moves) >= 2:
                print("\n=== Processing Round ===")
                # Get the last 2 moves (current round)
                current_round_moves = moves[-2:]
                move1, move2 = current_round_moves
                round_number = len(moves) // 2
                print(f"Round {round_number}")
                print(f"Move 1: {move1.player.username} - {move1.choice}")
                print(f"Move 2: {move2.player.username} - {move2.choice}")
                
                # Determine round winner
                winner = determine_winner(move1, move2)
                
                # Create round record
                round_obj = Round.objects.create(
                    match=match,
                    round_number=round_number,
                    move1=move1,
                    move2=move2,
                    is_draw=(winner is None)
                )
                
                if winner is not None:
                    round_obj.winner = winner.player
                    round_obj.save()
                    print(f"Round {round_number} winner: {winner.player.username}")
                else:
                    print(f"Round {round_number} is a draw")
                
                # Check if match is complete
                if match.is_match_complete():
                    match_winner = match.get_match_winner()
                    if match_winner:
                        match.winner = match_winner
                        print(f"Match winner: {match_winner.username}")
                    match.status = Match.Status.FINISHED
                    match.save(update_fields=['winner', 'status', 'updated_at'])
                    print(f"Match {match.id} is now FINISHED")
                else:
                    print(f"Match continues - Player1 wins: {match.get_player_wins(match.player1)}, Player2 wins: {match.get_player_wins(match.player2) if match.player2 else 0}")
            
            # Return the updated match state
            serializer = MatchSerializer(match, context={'request': request})
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Match.DoesNotExist:
            print(f"❌ Match {pk} not found")
            return Response(
                {"error": "Match not found"},
                status=status.HTTP_404_NOT_FOUND
            )
            
        except Exception as e:
            print(f"❌ Error in SubmitMoveView: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response(
                {"error": "An error occurred while processing your move"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
