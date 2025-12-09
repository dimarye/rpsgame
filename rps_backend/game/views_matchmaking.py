from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .services import matchmaking_service, rating_service
from .models import Match
from .models_matchmaking import MatchmakingQueue, BotPlayer
from .serializers import MatchSerializer

User = get_user_model()


class MatchmakingView(APIView):
    """API endpoint for matchmaking operations."""
    
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        """Join matchmaking queue."""
        data = request.data
        
        # Validate preferences
        preferred_difficulty = data.get('preferred_difficulty', 'any')
        allow_bots = data.get('allow_bots', True)
        
        if preferred_difficulty not in ['any', 'easy', 'medium', 'hard']:
            return Response(
                {'error': 'Invalid preferred difficulty'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Join queue
        queue_entry = matchmaking_service.join_queue(
            player=request.user,
            preferred_difficulty=preferred_difficulty,
            allow_bots=allow_bots
        )
        
        return Response({
            'queue_id': str(queue_entry.id),
            'status': queue_entry.status,
            'joined_at': queue_entry.created_at.isoformat(),
            'preferences': {
                'preferred_difficulty': queue_entry.preferred_difficulty,
                'allow_bots': queue_entry.allow_bots
            }
        })
    
    def delete(self, request):
        """Leave matchmaking queue."""
        count = matchmaking_service.leave_queue(request.user)
        
        return Response({
            'message': f'Removed {count} queue entries',
            'status': 'left_queue'
        })
    
    def get(self, request):
        """Get current queue status."""
        queue_entry = MatchmakingQueue.objects.filter(
            player=request.user,
            status=MatchmakingQueue.Status.WAITING
        ).first()
        
        if not queue_entry:
            return Response({
                'in_queue': False,
                'status': 'not_in_queue'
            })
        
        return Response({
            'in_queue': True,
            'queue_id': str(queue_entry.id),
            'status': queue_entry.status,
            'waiting_time': (timezone.now() - queue_entry.created_at).total_seconds(),
            'preferences': {
                'preferred_difficulty': queue_entry.preferred_difficulty,
                'allow_bots': queue_entry.allow_bots
            }
        })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def quick_match(request):
    """Quick match endpoint - optionally force a bot opponent."""
    try:
        opponent_type = request.data.get('opponent_type', 'any')
        requested_difficulty = request.data.get('difficulty', 'medium')
        valid_difficulties = {'easy', 'medium', 'hard'}

        if requested_difficulty not in valid_difficulties:
            return Response(
                {'error': 'Invalid difficulty. Choose easy, medium, or hard.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        prefer_bot_only = opponent_type == 'bot'
        human_only = opponent_type == 'human'

        if not prefer_bot_only:
            pending_match = Match.objects.filter(
                status=Match.Status.PENDING,
                player2__isnull=True
            ).exclude(player1=request.user).first()

            if pending_match:
                pending_match.player2 = request.user
                pending_match.status = Match.Status.ACTIVE
                pending_match.save()

                matchmaking_service._notify_match_created(pending_match)

                return Response({
                    'match_id': pending_match.id,
                    'status': 'joined_existing',
                    'message': 'Joined existing match'
                })

            if human_only:
                return Response(
                    {
                        'error': 'No human opponents available right now.',
                        'status': 'no_human_available'
                    },
                    status=status.HTTP_404_NOT_FOUND
                )

        bot = BotPlayer.objects.filter(
            is_active=True,
            difficulty=requested_difficulty
        ).first()

        if not bot:
            bot = BotPlayer.objects.create(
                user=User.objects.create_user(
                    username=f'bot_{requested_difficulty}_{timezone.now().timestamp()}',
                    email=f'bot_{requested_difficulty}@example.com',
                    password='bot_password_123',
                    is_bot=True,
                    bot_difficulty=requested_difficulty,
                    rating={'easy': 800, 'medium': 1000, 'hard': 1200}[requested_difficulty]
                ),
                difficulty=requested_difficulty,
                response_time_range={'min': 1.0, 'max': 3.0}
            )

        match = Match.objects.create(
            player1=request.user,
            player2=bot.user,
            status=Match.Status.ACTIVE
        )

        matchmaking_service._notify_match_created(match)

        return Response({
            'match_id': match.id,
            'status': 'created_with_bot',
            'message': 'Created match with bot',
            'opponent_type': 'bot',
            'difficulty': requested_difficulty
        })

    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def queue_status(request):
    """Get current matchmaking queue status."""
    waiting_count = MatchmakingQueue.objects.filter(
        status=MatchmakingQueue.Status.WAITING
    ).count()
    
    user_queue = MatchmakingQueue.objects.filter(
        player=request.user,
        status=MatchmakingQueue.Status.WAITING
    ).first()
    
    return Response({
        'total_waiting': waiting_count,
        'user_in_queue': user_queue is not None,
        'user_queue_id': str(user_queue.id) if user_queue else None,
        'user_waiting_time': (timezone.now() - user_queue.created_at).total_seconds() if user_queue else 0
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def update_ratings(request):
    """Manually trigger rating updates for completed matches (admin/debug endpoint)."""
    if not request.user.is_staff:
        return Response(
            {'error': 'Admin access required'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    match_id = request.data.get('match_id')
    if not match_id:
        return Response(
            {'error': 'match_id required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    match = get_object_or_404(Match, id=match_id)
    
    try:
        rating_service.update_match_ratings(match)
        return Response({
            'message': 'Ratings updated successfully',
            'match_id': match_id,
            'player1_rating': match.player1.rating,
            'player2_rating': match.player2.rating if match.player2 else None
        })
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
