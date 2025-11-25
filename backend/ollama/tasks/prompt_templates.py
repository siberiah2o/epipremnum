"""
图片分析提示词模板
提供各种分析任务的提示词生成器
"""


class PromptTemplates:
    """图片分析提示词模板类"""

    @staticmethod
    def title_prompt():
        """生成标题分析的提示词"""
        return """请为这张图片生成一个简洁、描述性的标题。
要求：
- 标题应该准确反映图片的主要内容
- 长度控制在5-20个字之间
- 避免使用"图片"、"图像"等通用词

请直接返回标题，不需要其他说明。"""

    @staticmethod
    def description_prompt():
        """生成描述分析的提示词"""
        return """请详细描述这张图片的内容。
要求：
- 描述图片中的主要对象、场景和活动
- 包含颜色、风格、构图等视觉元素
- 长度控制在50-200字之间
- 客观描述，避免过度想象

请直接返回描述内容，不需要其他说明。"""

    @staticmethod
    def categories_prompt(max_categories):
        """生成分类分析的提示词"""
        return f"""请为这张图片生成分类标签。
要求：
- 生成最多{max_categories}个相关的分类
- 分类应该基于图片的内容、风格和主题
- 使用简洁的中文分类名
- 每个分类2-6个字

请用逗号分隔返回分类列表，例如：风景, 自然, 山脉"""

    @staticmethod
    def tags_prompt(max_tags):
        """生成标签分析的提示词"""
        return f"""请为这张图片提取关键词标签。
要求：
- 生成最多{max_tags}个相关的标签
- 标签应该涵盖图片中的对象、场景、风格、情感等
- 使用简洁的中文关键词
- 每个标签1-4个字

请用逗号分隔返回标签列表，例如：山水, 日落, 橙色, 宁静"""

    @staticmethod
    def ai_prompt_prompt():
        """生成AI绘画提示词的提示词"""
        return """请为这张图片生成适合AI绘画的提示词。
要求：
- 描述如何重现类似这张图片的AI绘画
- 包含风格、构图、色彩、主体等要素
- 使用中文描述关键词，符合AI绘画工具的习惯
- 符合QwenImage、Flux、即梦、可灵等AI绘画工具的提示词生成习惯

请直接返回AI绘画提示词，不需要其他说明。"""

    @staticmethod
    def default_tags_prompt():
        """生成默认标签分析提示词（用于默认分析）"""
        return """请为这张图片提取关键词标签。
要求：
- 生成最多5个相关的标签
- 标签应该涵盖图片中的对象、场景、风格、情感等
- 使用简洁的中文关键词
- 每个标签1-4个字

请用逗号分隔返回标签列表，例如：山水, 日落, 橙色, 宁静"""


class TaskConfig:
    """分析任务配置类"""

    # 任务类型映射
    TASK_TYPES = {
        'title': {
            'name': '标题生成',
            'prompt_method': PromptTemplates.title_prompt,
            'default_max': None
        },
        'description': {
            'name': '描述生成',
            'prompt_method': PromptTemplates.description_prompt,
            'default_max': None
        },
        'categories': {
            'name': '分类生成',
            'prompt_method': PromptTemplates.categories_prompt,
            'default_max': 5
        },
        'tags': {
            'name': '标签生成',
            'prompt_method': PromptTemplates.tags_prompt,
            'default_max': 10
        },
        'prompt': {
            'name': 'AI绘画提示词',
            'prompt_method': PromptTemplates.ai_prompt_prompt,
            'default_max': None
        }
    }

    # 默认任务配置（当用户没有指定任何选项时）
    DEFAULT_TASKS = ['title', 'description', 'tags']

    @classmethod
    def get_task_prompt(cls, task_type, max_value=None):
        """获取指定任务的提示词"""
        if task_type not in cls.TASK_TYPES:
            raise ValueError(f"不支持的任务类型: {task_type}")

        task_config = cls.TASK_TYPES[task_type]
        prompt_method = task_config['prompt_method']

        if max_value is None:
            max_value = task_config['default_max']

        if max_value is not None:
            return prompt_method(max_value)
        else:
            return prompt_method()

    @classmethod
    def get_enabled_tasks(cls, options):
        """根据用户选项获取需要执行的任务列表"""
        tasks = []
        for task_type in cls.TASK_TYPES:
            if options.get(f'generate_{task_type}', False):
                tasks.append(task_type)
        return tasks

    @classmethod
    def get_default_tasks(cls):
        """获取默认任务列表"""
        return cls.DEFAULT_TASKS.copy()

