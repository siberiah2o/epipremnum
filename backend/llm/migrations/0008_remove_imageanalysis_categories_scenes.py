# Generated manually

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('llm', '0007_endpoint_provider_type'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='imageanalysis',
            name='categories',
        ),
        migrations.RemoveField(
            model_name='imageanalysis',
            name='scenes',
        ),
    ]
