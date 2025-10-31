from django.contrib import admin
from .models import Match, Move


class MoveInline(admin.TabularInline):
    model = Move
    extra = 0
    readonly_fields = ('timestamp',)
    fields = ('player', 'choice', 'timestamp')


@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = ('id', 'player1', 'player2', 'status', 'winner', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('player1__username', 'player2__username')
    inlines = [MoveInline]


@admin.register(Move)
class MoveAdmin(admin.ModelAdmin):
    list_display = ('id', 'match', 'player', 'choice', 'timestamp')
    list_filter = ('choice', 'timestamp')
    search_fields = ('player__username', 'match__id')
    readonly_fields = ('timestamp',)
