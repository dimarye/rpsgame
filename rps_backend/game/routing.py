from django.urls import re_path
from . import consumers

# WebSocket URL patterns
websocket_urlpatterns = [
    re_path(r'ws/match/(?P<match_id>\d+)/$', consumers.MatchConsumer.as_asgi()),
]
