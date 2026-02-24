# Simplification migration for llm app

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('llm', '0001_initial'),
    ]

    operations = [
        # 1. 删除 ModelConfig 模型（需要先删除索引和约束）
        migrations.AlterUniqueTogether(
            name='modelconfig',
            unique_together=set(),
        ),
        migrations.RemoveField(
            model_name='modelconfig',
            name='endpoint',
        ),
        migrations.RemoveField(
            model_name='modelconfig',
            name='model',
        ),
        migrations.RemoveField(
            model_name='modelconfig',
            name='owner',
        ),
        migrations.RemoveField(
            model_name='modelconfig',
            name='frequency_penalty',
        ),
        migrations.RemoveField(
            model_name='modelconfig',
            name='max_tokens',
        ),
        migrations.RemoveField(
            model_name='modelconfig',
            name='presence_penalty',
        ),
        migrations.RemoveField(
            model_name='modelconfig',
            name='system_prompt',
        ),
        migrations.RemoveField(
            model_name='modelconfig',
            name='temperature',
        ),
        migrations.RemoveField(
            model_name='modelconfig',
            name='top_k',
        ),
        migrations.RemoveField(
            model_name='modelconfig',
            name='top_p',
        ),
        migrations.RemoveField(
            model_name='modelconfig',
            name='is_default',
        ),
        migrations.DeleteModel(
            name='ModelConfig',
        ),

        # 2. 删除 Endpoint 的索引（需要先删除索引再删除字段）
        migrations.RemoveIndex(
            model_name='endpoint',
            name='llm_endpoin_provide_f16831_idx',
        ),
        migrations.RemoveIndex(
            model_name='endpoint',
            name='llm_endpoin_is_acti_61c27f_idx',
        ),

        # 3. 删除 AIModel 的索引
        migrations.RemoveIndex(
            model_name='aimodel',
            name='llm_aimodel_provide_f26527_idx',
        ),
        migrations.RemoveIndex(
            model_name='aimodel',
            name='llm_aimodel_model_t_211b91_idx',
        ),
        migrations.RemoveIndex(
            model_name='aimodel',
            name='llm_aimodel_is_acti_e910f6_idx',
        ),
        migrations.RemoveIndex(
            model_name='aimodel',
            name='llm_aimodel_is_publ_f3ecd4_idx',
        ),

        # 4. 删除 unique_together 约束
        migrations.AlterUniqueTogether(
            name='endpoint',
            unique_together=set(),
        ),
        migrations.AlterUniqueTogether(
            name='aimodel',
            unique_together=set(),
        ),

        # 5. 删除 AIModel 的 provider 外键
        migrations.RemoveField(
            model_name='aimodel',
            name='provider',
        ),

        # 6. 删除 Endpoint 的 provider 外键
        migrations.RemoveField(
            model_name='endpoint',
            name='provider',
        ),

        # 7. 删除 Provider 模型
        migrations.DeleteModel(
            name='Provider',
        ),

        # 8. 简化 Endpoint 模型 - 删除旧字段
        migrations.RemoveField(
            model_name='endpoint',
            name='slug',
        ),
        migrations.RemoveField(
            model_name='endpoint',
            name='description',
        ),
        migrations.RemoveField(
            model_name='endpoint',
            name='auth_type',
        ),
        migrations.RemoveField(
            model_name='endpoint',
            name='api_key_header',
        ),
        migrations.RemoveField(
            model_name='endpoint',
            name='endpoint_url',
        ),
        migrations.RemoveField(
            model_name='endpoint',
            name='is_default',
        ),
        migrations.RemoveField(
            model_name='endpoint',
            name='is_active',
        ),
        migrations.RemoveField(
            model_name='endpoint',
            name='rate_limit',
        ),
        migrations.RemoveField(
            model_name='endpoint',
            name='max_tokens',
        ),

        # 9. 添加新的 base_url 字段到 Endpoint
        migrations.AddField(
            model_name='endpoint',
            name='base_url',
            field=models.URLField(max_length=500, verbose_name='Base URL'),
        ),

        # 10. 简化 AIModel 模型 - 删除旧字段
        migrations.RemoveField(
            model_name='aimodel',
            name='slug',
        ),
        migrations.RemoveField(
            model_name='aimodel',
            name='display_name',
        ),
        migrations.RemoveField(
            model_name='aimodel',
            name='description',
        ),
        migrations.RemoveField(
            model_name='aimodel',
            name='model_type',
        ),
        migrations.RemoveField(
            model_name='aimodel',
            name='is_vision_capable',
        ),
        migrations.RemoveField(
            model_name='aimodel',
            name='is_streaming_supported',
        ),
        migrations.RemoveField(
            model_name='aimodel',
            name='supports_function_calling',
        ),
        migrations.RemoveField(
            model_name='aimodel',
            name='input_price',
        ),
        migrations.RemoveField(
            model_name='aimodel',
            name='output_price',
        ),
        migrations.RemoveField(
            model_name='aimodel',
            name='max_tokens',
        ),
        migrations.RemoveField(
            model_name='aimodel',
            name='max_context_length',
        ),
        migrations.RemoveField(
            model_name='aimodel',
            name='is_active',
        ),
        migrations.RemoveField(
            model_name='aimodel',
            name='is_public',
        ),

        # 11. 添加新的 endpoint 外键到 AIModel
        migrations.AddField(
            model_name='aimodel',
            name='endpoint',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='models',
                verbose_name='API端点',
                to='llm.endpoint'
            ),
        ),
    ]
