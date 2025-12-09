from django.db import migrations, models


def enforce_three_wins(apps, schema_editor):
    Match = apps.get_model('game', 'Match')
    Match.objects.filter(wins_needed__lt=3).update(wins_needed=3)


class Migration(migrations.Migration):

    dependencies = [
        ('game', '0004_matchmakingqueue_botplayer'),
    ]

    operations = [
        migrations.AlterField(
            model_name='match',
            name='wins_needed',
            field=models.PositiveSmallIntegerField(default=3),
        ),
        migrations.RunPython(enforce_three_wins, migrations.RunPython.noop),
    ]
