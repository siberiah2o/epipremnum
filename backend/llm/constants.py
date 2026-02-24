"""
LLM 模块常量定义

集中管理所有常量、提示词模板和配置
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Prompts:
    """AI 分析提示词模板"""

    # 单次请求获取完整分析（JSON 格式）
    SINGLE_REQUEST: str = """请分析这张图片，并以 JSON 格式返回以下信息：
1. description: 详细描述图片内容（物体、颜色、布局、文字等）
2. categories: 分类标签（最多5个，选择最核心的分类，如：人物、风景、建筑、动物、产品等）
3. scenes: 场景标签（最多5个，选择最主要的场景，如：室内、室外、办公室、街道、自然等）

返回格式要求：
- 必须是有效的 JSON 格式
- categories 和 scenes 每个最多5个
- 标签要简洁精准，不要重复
- 标签用中文

示例返回格式：
{
  "description": "一张展示现代办公环境的照片...",
  "categories": ["室内", "办公", "建筑"],
  "scenes": ["办公室", "会议室", "工作空间"]
}"""

    # 仅获取描述
    DESCRIPTION_ONLY: str = "请简要描述这张图片的内容。"

    # 从描述提取分类
    CATEGORIES_FROM_DESC: str = """根据以下图片描述，提取3-5个核心分类标签（如：人物、风景、建筑、动物、产品等）。
只返回标签，用顿号分隔。

描述：{description}"""

    # 从描述提取场景
    SCENES_FROM_DESC: str = """根据以下图片描述，提取3-5个主要场景标签（如：室内、室外、办公室、街道、自然等）。
只返回标签，用顿号分隔。

描述：{description}"""


@dataclass(frozen=True)
class AnalysisDefaults:
    """分析相关默认值"""

    # API 超时时间（秒）
    API_TIMEOUT: int = 120

    # 最大重试次数
    MAX_RETRIES: int = 3

    # 最大分类数量
    MAX_CATEGORIES: int = 5

    # 最大场景数量
    MAX_SCENES: int = 5

    # 最大 Token 数
    MAX_TOKENS_SINGLE: int = 1000
    MAX_TOKENS_DESCRIPTION: int = 500
    MAX_TOKENS_TAGS: int = 100

    # 温度参数
    TEMPERATURE: float = 0.7

    # 预测 Token 数（Ollama）
    NUM_PREDICT: int = 1000


@dataclass(frozen=True)
class TaskDefaults:
    """任务相关默认值"""

    # 任务列表默认分页
    DEFAULT_LIMIT: int = 20
    DEFAULT_OFFSET: int = 0

    # 批量任务组名前缀
    BATCH_GROUP_PREFIX: str = "batch"


@dataclass(frozen=True)
class WebSocket:
    """WebSocket 相关常量"""

    # 频道组名前缀
    ANALYSIS_CHANNEL_PREFIX: str = "analysis_"

    # 消息类型
    MSG_TYPE_ANALYSIS_UPDATE: str = "analysis_update"
    MSG_TYPE_STATS_UPDATE: str = "stats_update"
    MSG_TYPE_PING: str = "ping"
    MSG_TYPE_PONG: str = "pong"


# 导出常量实例
PROMPTS = Prompts()
ANALYSIS_DEFAULTS = AnalysisDefaults()
TASK_DEFAULTS = TaskDefaults()
WEBSOCKET = WebSocket()
