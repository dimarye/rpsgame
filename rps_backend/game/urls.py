from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    path('matches/', views.MatchListView.as_view(), name='match-list'),
    path('matches/<int:pk>/', views.MatchDetailView.as_view(), name='match-detail'),
    path('matches/<int:pk>/join/', views.JoinMatchView.as_view(), name='join-match'),
    path('matches/<int:pk>/move/', views.SubmitMoveView.as_view(), name='submit-move'),
]
