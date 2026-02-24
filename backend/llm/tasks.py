"""
Django Q2 异步任务模块

所有任务都委托给服务层处理，保持任务层的简洁

使用示例:
    from django_q.tasks import async_task
    from llm.tasks import analyze_image_task

    # 异步执行图片分析任务
    task_id = async_task(
        analyze_image_task,
        media_id=1,
        model_id=1,
        user_id=1,
        save=True
    )
"""

import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)


def analyze_image_task(media_id: int, model_id: int, user_id: int) -> int:
    """
    异步分析图片任务

    创建分析记录并执行分析

    Args:
        media_id: 媒体文件 ID
        model_id: AI 模型 ID
        user_id: 用户 ID

    Returns:
        int: 分析记录 ID
    """
    from llm.services import AnalysisService
    from llm.exceptions import LLMException

    try:
        # 创建分析记录
        analysis = AnalysisService.create_analysis(media_id, model_id, user_id)

        # 执行分析
        AnalysisService.execute_analysis(analysis.id)

        logger.info(f"图片分析任务完成: analysis_id={analysis.id}")
        return analysis.id

    except LLMException as e:
        logger.error(f"图片分析任务失败: {e.message}")
        raise
    except Exception as e:
        logger.error(f"图片分析任务失败: {str(e)}")
        raise


def execute_analysis_task(analysis_id: int) -> int:
    """
    执行已存在的分析任务

    用于重试或恢复已创建的分析

    Args:
        analysis_id: 分析记录 ID

    Returns:
        int: 分析记录 ID
    """
    from llm.services import AnalysisService
    from llm.exceptions import LLMException

    try:
        AnalysisService.execute_analysis(analysis_id)
        logger.info(f"执行分析任务完成: analysis_id={analysis_id}")
        return analysis_id

    except LLMException as e:
        logger.error(f"执行分析任务失败: {e.message}")
        raise
    except Exception as e:
        logger.error(f"执行分析任务失败: {str(e)}")
        raise


def retry_analysis_task(analysis_id: int) -> int:
    """
    重试分析任务

    重置分析状态并重新执行

    Args:
        analysis_id: 分析记录 ID

    Returns:
        int: 分析记录 ID
    """
    from llm.services import AnalysisService
    from llm.exceptions import LLMException

    try:
        # 获取分析记录以获取 user_id
        from llm.models import ImageAnalysis
        analysis = ImageAnalysis.objects.get(id=analysis_id)

        # 使用服务层重置状态
        AnalysisService.retry_analysis(analysis_id, analysis.user_id)

        # 执行分析
        AnalysisService.execute_analysis(analysis_id)

        logger.info(f"重试分析任务完成: analysis_id={analysis_id}")
        return analysis_id

    except LLMException as e:
        logger.error(f"重试分析任务失败: {e.message}")
        raise
    except Exception as e:
        logger.error(f"重试分析任务失败: {str(e)}")
        raise


def sync_models_task(endpoint_id: int, user_id: int) -> Dict[str, Any]:
    """
    异步同步模型列表任务

    Args:
        endpoint_id: 端点 ID
        user_id: 用户 ID

    Returns:
        Dict[str, Any]: 同步结果
    """
    from llm.services import SyncService
    from llm.exceptions import LLMException

    try:
        result = SyncService.sync_models(endpoint_id, user_id)
        logger.info(f"模型同步任务完成: endpoint_id={endpoint_id}")
        return result

    except LLMException as e:
        logger.error(f"模型同步任务失败: {e.message}")
        raise
    except Exception as e:
        logger.error(f"模型同步任务失败: endpoint_id={endpoint_id}, error={str(e)}")
        raise
