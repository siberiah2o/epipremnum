"""
图片分析提示词模板
提供各种分析任务的提示词生成器
使用LangChain的PromptTemplate增强功能
"""

from langchain_core.prompts import PromptTemplate, ChatPromptTemplate
from langchain_core.messages import HumanMessage
from typing import Dict, Any, Optional


class LangChainPromptTemplates:
    """使用LangChain的图片分析提示词模板类"""

    @staticmethod
    def title_prompt_template() -> PromptTemplate:
        """生成标题分析的PromptTemplate"""
        template = """请为这张图片生成一个准确的标题。

这个标题将用于：
1. 作为图片的文件名或索引名称
2. 帮助用户快速识别图片内容
3. 便于搜索和检索

要求：
- 标题要准确描述图片的核心内容
- 使用简洁、清晰的语言
- 长度控制在5-20个字之间
- 避免使用"图片"、"照片"等通用词
- 重点描述主要对象、场景或事件

请直接返回标题，不要包含任何解释。"""
        return PromptTemplate(
            input_variables=[],
            template=template
        )

    @staticmethod
    def description_prompt_template() -> PromptTemplate:
        """生成描述分析的PromptTemplate"""
        template = """请详细描述这张图片的内容。

这个描述将用于：
1. AI反向生成或还原相似图片
2. 为图片打标签和分类的参考
3. 图片搜索和内容理解

要求：
- 详细描述所有可见的元素、对象、场景
- 包含位置关系、空间布局信息
- 描述颜色、光影、材质等视觉特征
- 说明人物的动作、表情、服装等细节
- 描述环境、背景、氛围等信息
- 长度控制在50-500字之间
- 使用客观、准确的语言，避免主观评价
- 包含足够的细节以便于AI理解和重现

请直接返回描述内容，不要包含任何分析过程。"""
        return PromptTemplate(
            input_variables=[],
            template=template
        )

    @staticmethod
    def categories_prompt_template(max_categories: int) -> PromptTemplate:
        """生成分类分析的PromptTemplate"""
        template = """请为这张图片生成准确的分类。

分类用于：
1. 组织和管理图片库
2. 快速筛选和查找特定类型的内容
3. 建立内容分类体系

要求：
- 根据图片主要内容确定分类
- 分类要具有概括性和代表性
- 生成最多{max_categories}个分类
- 使用通用的、易于理解的分类名称
- 每个分类2-6个字
- 优先考虑主要分类，再考虑次要分类
- 避免过于具体或过于宽泛的分类

常见的分类示例：
- 风景类：自然风光、城市景观、建筑、海洋、山脉等
- 人物类：人物肖像、团体照、活动照片等
- 物品类：美食、动物、植物、交通工具、科技产品等
- 艺术类：绘画、雕塑、设计、摄影作品等
- 场景类：室内、室外、工作、休闲、运动等

请用逗号分隔返回分类列表。"""
        return PromptTemplate(
            input_variables=["max_categories"],
            template=template
        )

    @staticmethod
    def tags_prompt_template(max_tags: int) -> PromptTemplate:
        """生成标签分析的PromptTemplate"""
        template = """请为这张图片提取精准的关键词标签。

标签用于：
1. 精确标记图片的具体内容
2. 支持多维度搜索和筛选
3. 与相似内容建立关联
4. AI内容理解和推荐

要求：
- 提取图片中的所有关键元素
- 生成最多{max_tags}个标签
- 标签要具体、准确、有代表性
- 每个标签1-4个字
- 包括但不限于：
  * 主要对象（人物、动物、物品等）
  * 环境场景（室内、室外、具体地点等）
  * 动作状态（坐、立、运动等）
  * 颜色特征（红色、蓝色、多彩等）
  * 情感氛围（快乐、安静、紧张等）
  * 风格特点（复古、现代、艺术等）
  * 技术特征（特写、远景、黑白等）
- 避免使用主观评价标签
- 优先使用能被其他用户理解的通用词汇

请用逗号分隔返回标签列表。"""
        return PromptTemplate(
            input_variables=["max_tags"],
            template=template
        )

    @staticmethod
    def multimodal_prompt_template(text_prompt: str) -> ChatPromptTemplate:
        """生成多模态分析的ChatPromptTemplate"""
        return ChatPromptTemplate.from_messages([
            ("human", [
                {
                    "type": "text",
                    "text": text_prompt
                },
                {
                    "type": "image_url",
                    "image_url": "data:image/jpeg;base64,{image_base64}"
                }
            ])
        ])

    @staticmethod
    def few_shot_prompt_template(base_prompt: str, examples: list) -> ChatPromptTemplate:
        """生成包含示例的Few-shot PromptTemplate"""
        messages = [("system", "你是一个专业的图片分析师，请根据示例的格式回答。")]

        # 添加示例
        for example in examples:
            messages.append(("human", example["input"]))
            messages.append(("ai", example["output"]))

        # 添加实际的问题
        messages.append(("human", base_prompt))

        return ChatPromptTemplate.from_messages(messages)


class PromptTemplates:
    """图片分析提示词模板类（向后兼容）"""

    @staticmethod
    def title_prompt():
        """生成标题分析的提示词"""
        return LangChainPromptTemplates.title_prompt_template().template

    @staticmethod
    def description_prompt():
        """生成描述分析的提示词"""
        return LangChainPromptTemplates.description_prompt_template().template

    @staticmethod
    def categories_prompt(max_categories):
        """生成分类分析的提示词"""
        return LangChainPromptTemplates.categories_prompt_template(max_categories).format(max_categories=max_categories)

    @staticmethod
    def tags_prompt(max_tags):
        """生成标签分析的提示词"""
        return LangChainPromptTemplates.tags_prompt_template(max_tags).format(max_tags=max_tags)

    @staticmethod
    def default_tags_prompt():
        """生成默认标签分析提示词（用于默认分析）"""
        return LangChainPromptTemplates.tags_prompt_template(5).format(max_tags=5)


class TaskConfig:
    """分析任务配置类"""

    # 任务类型映射
    TASK_TYPES = {
        'title': {
            'name': '标题生成',
            'prompt_method': PromptTemplates.title_prompt,
            'langchain_template_method': LangChainPromptTemplates.title_prompt_template,
            'default_max': None
        },
        'description': {
            'name': 'AI描述生成',
            'prompt_method': PromptTemplates.description_prompt,
            'langchain_template_method': LangChainPromptTemplates.description_prompt_template,
            'default_max': None
        },
        'categories': {
            'name': '分类生成',
            'prompt_method': PromptTemplates.categories_prompt,
            'langchain_template_method': LangChainPromptTemplates.categories_prompt_template,
            'default_max': 5
        },
        'tags': {
            'name': '标签生成',
            'prompt_method': PromptTemplates.tags_prompt,
            'langchain_template_method': LangChainPromptTemplates.tags_prompt_template,
            'default_max': 10
        }
    }

    # 默认任务配置（当用户没有指定任何选项时）
    DEFAULT_TASKS = ['title', 'description', 'tags']

    @classmethod
    def get_task_prompt(cls, task_type: str, max_value: Optional[int] = None) -> str:
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
    def get_langchain_template(cls, task_type: str, max_value: Optional[int] = None) -> PromptTemplate:
        """获取指定任务的LangChain PromptTemplate"""
        if task_type not in cls.TASK_TYPES:
            raise ValueError(f"不支持的任务类型: {task_type}")

        task_config = cls.TASK_TYPES[task_type]
        template_method = task_config['langchain_template_method']

        if max_value is None:
            max_value = task_config['default_max']

        if max_value is not None:
            return template_method(max_value)
        else:
            return template_method()

    @classmethod
    def get_multimodal_template(cls, prompt: str) -> ChatPromptTemplate:
        """获取多模态ChatPromptTemplate"""
        return LangChainPromptTemplates.multimodal_prompt_template(prompt)

    @classmethod
    def get_enabled_tasks(cls, options: Dict[str, Any]) -> list:
        """根据用户选项获取需要执行的任务列表"""
        tasks = []
        for task_type in cls.TASK_TYPES:
            if options.get(f'generate_{task_type}', False):
                tasks.append(task_type)
        return tasks

    @classmethod
    def get_default_tasks(cls) -> list:
        """获取默认任务列表"""
        return cls.DEFAULT_TASKS.copy()