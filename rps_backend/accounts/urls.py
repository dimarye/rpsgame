from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import RegisterView, UserDetailView, LogoutView, CustomTokenObtainPairView

urlpatterns = [
    # Authentication endpoints
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    
    # User endpoints
    path('users/me/', UserDetailView.as_view(), name='user_detail'),
]
