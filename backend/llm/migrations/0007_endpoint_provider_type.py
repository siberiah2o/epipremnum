# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('llm', '0006_imageanalysis_error_details_imageanalysis_error_type_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='endpoint',
            name='provider_type',
            field=models.CharField(
                choices=[('ollama', 'Ollama'), ('openai', 'OpenAI Compatible'), ('zhipu', '智谱 AI')],
                default='openai',
                max_length=20,
                verbose_name='提供商类型'
            ),
        ),
    ]
