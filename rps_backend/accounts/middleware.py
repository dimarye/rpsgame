from urllib.parse import parse_qs
from django.contrib.auth.models import AnonymousUser
from channels.middleware import BaseMiddleware
from rest_framework_simplejwt.tokens import AccessToken
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model

User = get_user_model()

@database_sync_to_async
def get_user_from_token(token):
    try:
        access = AccessToken(token)
        user_id = access['user_id']
        user = User.objects.get(id=user_id)
        print(f"[JWT] Successfully authenticated user {user.username} (ID: {user_id})")
        return user
    except Exception as e:
        print(f"[JWT] Authentication failed: {e}")
        return AnonymousUser()

class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        query_string = scope.get("query_string", b"").decode()
        query_params = parse_qs(query_string)
        token = query_params.get("token", [None])[0]
        
        print(f"[JWT] WebSocket connection attempt, token present: {bool(token)}")
        
        if token:
            scope["user"] = await get_user_from_token(token)
        else:
            print("[JWT] No token provided, using AnonymousUser")
            scope["user"] = AnonymousUser()
            
        return await super().__call__(scope, receive, send)
