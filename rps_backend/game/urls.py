from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views
from . import views_matchmaking

urlpatterns = [
    path('matches/', views.MatchListView.as_view(), name='match-list'),
    path('matches/<int:pk>/', views.MatchDetailView.as_view(), name='match-detail'),
    path('matches/<int:pk>/join/', views.JoinMatchView.as_view(), name='join-match'),
    path('matches/<int:pk>/move/', views.SubmitMoveView.as_view(), name='submit-move'),
    
    # Matchmaking endpoints
    path('matchmaking/', views_matchmaking.MatchmakingView.as_view(), name='matchmaking'),
    path('matchmaking/quick/', views_matchmaking.quick_match, name='quick-match'),
    path('matchmaking/queue/', views_matchmaking.queue_status, name='queue-status'),
    path('matchmaking/update-ratings/', views_matchmaking.update_ratings, name='update-ratings'),
]
