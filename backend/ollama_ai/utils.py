"""Ollama AI应用的工具函数"""

from .models import OllamaModel


def sync_ollama_models():
    """从Ollama服务同步模型信息到数据库"""
    from .services import OllamaClient

    try:
        client = OllamaClient()
        models_data = client.list_models()

        synced_count = 0
        for model_data in models_data:
            model_name = model_data.get('name', '')

            # 检查是否为视觉模型（通过family判断）
            details = model_data.get('details', {})
            families = details.get('families', [])

            is_vision_capable = any(
                family in ['qwen3vl', 'clip', 'llava', 'minicpm', 'vision']
                for family in families
            )

            if is_vision_capable:
                # 获取模型大小
                size_bytes = model_data.get('size', 0)
                size_gb = round(size_bytes / (1024**3), 2) if size_bytes > 0 else None

                # 创建或更新模型记录
                model, created = OllamaModel.objects.update_or_create(
                    name=model_name,
                    defaults={
                        'display_name': model_name.replace('/', ' - ').title(),
                        'description': f"视觉模型 - 参数规模: {details.get('parameter_size', 'Unknown')}",
                        'is_active': True,
                        'is_vision_capable': True,
                        'model_size': f"{size_gb}GB" if size_gb else None,
                    }
                )

                synced_count += 1
                print(f"{'创建' if created else '更新'}模型: {model_name}")

        # 禁用不再存在的视觉模型
        existing_model_names = {m.get('name') for m in models_data}
        vision_families = ['qwen3vl', 'clip', 'llava', 'minicpm', 'vision']
        current_vision_models = {
            m.get('name') for m in models_data
            if any(fam in existing_model_names for fam in vision_families)
        }

        disabled_count = OllamaModel.objects.filter(
            is_vision_capable=True
        ).exclude(
            name__in=current_vision_models
        ).update(is_active=False)

        print(f"同步完成: {synced_count} 个视觉模型, {disabled_count} 个模型被禁用")
        return synced_count

    except Exception as e:
        print(f"同步模型失败: {str(e)}")
        return 0


def get_default_vision_model():
    """获取默认的视觉模型"""
    # 优先级: qwen3-vl:4b > qwen3-vl:2b > 其他视觉模型
    preferred_order = [
        'qwen3-vl:4b-instruct-bf16',
        'qwen3-vl:2b-instruct-bf16',
        'qwen3-vl:8b-instruct-bf16'
    ]

    for model_name in preferred_order:
        try:
            model = OllamaModel.objects.get(
                name=model_name,
                is_active=True,
                is_vision_capable=True
            )
            return model
        except OllamaModel.DoesNotExist:
            continue

    # 如果没有首选模型，返回第一个可用的视觉模型
    model = OllamaModel.objects.filter(
        is_active=True,
        is_vision_capable=True
    ).first()

    return model


def create_sample_models():
    """创建示例模型（用于演示）"""
    sample_models = [
        {
            'name': 'qwen3-vl:4b-instruct-bf16',
            'display_name': 'Qwen3-VL 4B',
            'description': '通义千问视觉语言模型，4B参数版本，适合快速推理',
            'is_active': True,
            'is_vision_capable': True,
            'model_size': '8.27GB'
        },
        {
            'name': 'qwen3-vl:2b-instruct-bf16',
            'display_name': 'Qwen3-VL 2B',
            'description': '通义千问视觉语言模型，2B参数版本，轻量级选择',
            'is_active': True,
            'is_vision_capable': True,
            'model_size': '3.97GB'
        },
        {
            'name': 'qwen3-vl:8b-instruct-bf16',
            'display_name': 'Qwen3-VL 8B',
            'description': '通义千问视觉语言模型，8B参数版本，更高精度',
            'is_active': True,
            'is_vision_capable': True,
            'model_size': '16.34GB'
        },
        {
            'name': 'openbmb/minicpm-v4.5:q8_0',
            'display_name': 'MiniCPM-V 4.5',
            'description': 'MiniCPM视觉模型，高效的端侧部署选择',
            'is_active': True,
            'is_vision_capable': True,
            'model_size': '9.13GB'
        },
        {
            'name': 'qwen3-vl:30b-a3b-instruct-q4_K_M',
            'display_name': 'Qwen3-VL 30B',
            'description': '通义千问视觉语言模型，30B参数MoE版本，最高精度',
            'is_active': True,
            'is_vision_capable': True,
            'model_size': '18.25GB'
        }
    ]

    created_count = 0
    for model_data in sample_models:
        model, created = OllamaModel.objects.get_or_create(
            name=model_data['name'],
            defaults=model_data
        )
        if created:
            created_count += 1
            print(f"创建示例模型: {model.display_name}")

    print(f"创建了 {created_count} 个示例模型")
    return created_count