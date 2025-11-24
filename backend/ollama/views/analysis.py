"""
图片分析视图处理器
提供图片分析任务的创建、查询、管理等功能
"""

import logging
logger = logging.getLogger(__name__)

from rest_framework.decorators import action
from .base import BaseResponseHandler, BaseViewSetMixin
from typing import Dict, Any
from ..serializers import (
    OllamaImageAnalysisCreateSerializer,
    OllamaImageAnalysisTaskCreateSerializer,
    OllamaImageAnalysisTaskStatusSerializer,
    OllamaImageAnalysisTaskListSerializer,
    OllamaImageAnalysisTaskRetrySerializer,
    OllamaImageAnalysisTaskCancelSerializer,
    BatchStatusQuerySerializer,
    BatchStatusResponseSerializer,
    OllamaImageAnalysisBatchTaskSerializer
)
from ..tasks.manager import OllamaTaskManager
from django.utils import timezone


class AnalysisTaskHandler(BaseViewSetMixin):
    """图片分析任务处理器"""

    def __init__(self, viewset_instance):
        self.viewset = viewset_instance
        self.request = viewset_instance.request
        self.task_manager = OllamaTaskManager()

    def create_task(self):
        """创建图片分析任务"""
        serializer = OllamaImageAnalysisCreateSerializer(data=self.request.data)
        serializer.is_valid(raise_exception=True)

        # 验证模型名称（如果有指定）
        model_name = serializer.validated_data.get('model_name')
        if model_name:
            model_validation = self._validate_model_for_user(model_name)
            if not model_validation['valid']:
                return BaseResponseHandler.error_response(
                    message=model_validation['error']
                )

        # 创建分析任务
        result = self.task_manager.create_task(
            user=self.request.user,
            media_id=serializer.validated_data['media_id'],
            model_name=model_name,
            analysis_options=serializer.validated_data.get('options', {}),
            prompt=serializer.validated_data.get('prompt')
        )

        if result['success']:
            # 序列化返回数据
            response_serializer = OllamaImageAnalysisTaskCreateSerializer(data=result)
            response_serializer.is_valid(raise_exception=True)

            return BaseResponseHandler.created_response(
                message='图片分析任务创建成功',
                data=response_serializer.data
            )
        else:
            # 如果有data字段（如重复任务信息），也一并返回
            return BaseResponseHandler.error_response(
                message=result['error'],
                data=result.get('data')
            )

    def get_task_status(self, analysis_id):
        """获取任务状态"""
        result = self.task_manager.get_task_status(analysis_id, self.request.user)

        if result['success']:
            # 序列化返回数据
            response_serializer = OllamaImageAnalysisTaskStatusSerializer(result)

            return BaseResponseHandler.success_response(
                message='获取任务状态成功',
                data=response_serializer.data
            )
        else:
            return BaseResponseHandler.error_response(
                message=result['error']
            )

    def list_tasks(self):
        """获取任务列表"""
        # 获取查询参数
        status_filter = self.request.query_params.get('status')
        limit = min(int(self.request.query_params.get('limit', 50)), 100)
        offset = max(int(self.request.query_params.get('offset', 0)), 0)

        result = self.task_manager.list_tasks(
            user=self.request.user,
            status_filter=status_filter,
            limit=limit,
            offset=offset
        )

        if result['success']:
            # 序列化任务列表
            task_list = result['tasks']
            serializer = OllamaImageAnalysisTaskListSerializer(task_list, many=True)

            return BaseResponseHandler.success_response(
                message='获取任务列表成功',
                data={
                    'tasks': serializer.data,
                    'total_count': result['total_count'],
                    'limit': limit,
                    'offset': offset
                }
            )
        else:
            return BaseResponseHandler.error_response(
                message=result['error']
            )

    def retry_task(self, analysis_id):
        """重试失败的任务"""
        result = self.task_manager.retry_task(analysis_id, self.request.user)

        if result['success']:
            # 序列化返回数据
            response_serializer = OllamaImageAnalysisTaskRetrySerializer(data=result)
            response_serializer.is_valid(raise_exception=True)

            return BaseResponseHandler.success_response(
                message='任务重试已启动',
                data=response_serializer.data
            )
        else:
            return BaseResponseHandler.error_response(
                message=result['error']
            )

    def cancel_task(self, analysis_id):
        """取消正在进行的任务"""
        result = self.task_manager.cancel_task(analysis_id, self.request.user)

        if result['success']:
            # 序列化返回数据
            response_serializer = OllamaImageAnalysisTaskCancelSerializer(data=result)
            response_serializer.is_valid(raise_exception=True)

            return BaseResponseHandler.success_response(
                message='任务取消已启动',
                data=response_serializer.data
            )
        else:
            return BaseResponseHandler.error_response(
                message=result['error']
            )

    def _validate_model_for_user(self, model_name):
        """验证用户是否有权限使用指定模型"""
        try:
            from ..models import OllamaAIModel

            # 查找用户拥有的模型
            model = OllamaAIModel.objects.filter(
                endpoint__created_by=self.viewset.request.user,
                name=model_name,
                is_active=True,
                is_vision_capable=True
            ).first()

            if not model:
                return {
                    'valid': False,
                    'error': f'模型 "{model_name}" 不存在或不支持视觉分析'
                }

            return {'valid': True, 'model': model}

        except Exception as e:
            return {
                'valid': False,
                'error': f'验证模型失败: {str(e)}'
            }


class AnalysisBatchHandler(BaseViewSetMixin):
    """批量分析处理器"""

    def __init__(self, viewset_instance):
        self.viewset = viewset_instance
        self.request = viewset_instance
        from ..tasks.image_analyzer import OllamaImageAnalyzer
        from ..tasks.manager import OllamaTaskManager
        from ..models import OllamaImageAnalysis
        self.analyzer = OllamaImageAnalyzer()
        self.task_manager = OllamaTaskManager()

    def batch_create_tasks(self):
        """批量创建分析任务 - 使用新的并发架构"""
        media_ids = self.viewset.request.data.get('media_ids', [])
        model_name = self.viewset.request.data.get('model_name')
        analysis_options = self.viewset.request.data.get('options', {})

        # 验证输入参数
        if not isinstance(media_ids, list) or not media_ids:
            return BaseResponseHandler.error_response(
                message='media_ids 必须是非空数组'
            )

        if len(media_ids) > 20:  # 限制批量大小
            return BaseResponseHandler.error_response(
                message='单次批量操作最多支持20个文件'
            )

        # 验证并发控制参数
        concurrency_errors = self._validate_concurrency_options(analysis_options)
        if concurrency_errors:
            return BaseResponseHandler.error_response(
                message=f'并发控制参数验证失败: {"; ".join(concurrency_errors)}'
            )

        # 验证模型（如果有指定）
        if model_name:
            model_validation = self._validate_model_for_user(model_name)
            if not model_validation['valid']:
                return BaseResponseHandler.error_response(
                    message=model_validation['error']
                )

        # 准备媒体信息
        from media.models import Media
        media_items = []
        validation_errors = []

        # 验证并准备媒体信息
        for media_id in media_ids:
            try:
                media = Media.objects.get(id=media_id, user=self.viewset.request.user)
                media_items.append((media_id, media.title or f"图片_{media_id}"))
            except Media.DoesNotExist:
                validation_errors.append({
                    'media_id': media_id,
                    'error': '媒体文件不存在或无权访问'
                })

        if validation_errors:
            return BaseResponseHandler.error_response(
                message=f'媒体文件验证失败',
                data={'validation_errors': validation_errors}
            )

        # 使用新的图片级并发批量分析任务
        from ..tasks.batch_processor import analyze_images_with_concurrency_task

        # 准备媒体ID列表（只包括没有正在进行的任务的）
        valid_media_ids = []
        from ..models import OllamaAIModel, OllamaImageAnalysis

        # 获取模型
        if model_name:
            model = OllamaAIModel.objects.get(name=model_name, endpoint__created_by=self.viewset.request.user)
        else:
            model = OllamaAIModel.objects.filter(
                endpoint__created_by=self.viewset.request.user,
                is_default=True
            ).first()
            if not model:
                return BaseResponseHandler.error_response(
                    message='没有可用的分析模型'
                )

        # 检查每个媒体文件是否有重复任务
        for media_id, _ in media_items:
            media = Media.objects.get(id=media_id, user=self.viewset.request.user)

            # 检查重复任务
            existing_analysis = OllamaImageAnalysis.objects.filter(
                media=media,
                model=model,
                analysis_options=analysis_options,
                status__in=['pending', 'processing']
            ).first()

            if not existing_analysis:
                valid_media_ids.append(media_id)

        if not valid_media_ids:
            return BaseResponseHandler.error_response(
                message='没有可分析的文件（所有文件都有任务在进行）'
            )

        logger.info(f"启动图片级并发批量分析任务: {len(valid_media_ids)} 个图片，用户: {self.viewset.request.user.id}")

        # 启动图片级并发批量分析任务
        task = analyze_images_with_concurrency_task.run_async(
            media_ids=valid_media_ids,
            model_name=model_name,
            analysis_options=analysis_options,
            user_id=self.viewset.request.user.id
        )

        batch_result = {
            'success_count': len(valid_media_ids),
            'error_count': 0,
            'total_processing_time_ms': 0,
            'task_id': str(task.id)
        }

        # 构建异步响应数据
        results = []
        errors = []

        # 为每个有效的媒体ID创建任务记录
        for media_id in valid_media_ids:
            results.append({
                'media_id': media_id,
                'status': 'pending',
                'message': '批量分析任务已启动',
                'task_id': batch_result['task_id']
            })

        # 添加验证错误
        errors.extend(validation_errors)

        return BaseResponseHandler.success_response(
            message=f'批量分析任务已启动: {len(valid_media_ids)} 个文件正在处理',
            data={
                'batch_info': {
                    'total_requested': len(media_ids),
                    'valid_count': len(valid_media_ids),
                    'skipped_count': len(media_ids) - len(valid_media_ids),
                    'max_concurrent': analysis_options.get('max_concurrent', 5),
                    'task_id': batch_result['task_id']
                },
                'submitted_tasks': results,
                'failed_items': errors,
                'total_count': len(media_ids),
                'success_count': len(valid_media_ids),
                'error_count': len(errors)
            }
        )

    def _prepare_single_analysis(self, analysis, prompt_text: str) -> Dict[str, Any]:
        """为统一并发控制器准备单次分析的数据"""
        return self.analyzer._prepare_single_analysis(analysis, prompt_text)

    def batch_cancel_tasks(self):
        """批量取消任务"""
        analysis_ids = self.viewset.request.data.get('analysis_ids', [])

        # 验证输入参数
        if not isinstance(analysis_ids, list) or not analysis_ids:
            return BaseResponseHandler.error_response(
                message='analysis_ids 必须是非空数组'
            )

        if len(analysis_ids) > 50:  # 限制批量大小
            return BaseResponseHandler.error_response(
                message='单次批量操作最多支持50个任务'
            )

        # 批量取消任务
        results = []
        errors = []

        for analysis_id in analysis_ids:
            try:
                result = self.task_manager.cancel_task(analysis_id, self.viewset.request.user)

                if result['success']:
                    results.append({
                        'analysis_id': analysis_id,
                        'task_id': result['task_id']
                    })
                else:
                    errors.append({
                        'analysis_id': analysis_id,
                        'error': result['error']
                    })

            except Exception as e:
                errors.append({
                    'analysis_id': analysis_id,
                    'error': str(e)
                })

        return BaseResponseHandler.success_response(
            message=f'批量任务取消完成: 成功 {len(results)} 个, 失败 {len(errors)} 个',
            data={
                'cancelled_tasks': results,
                'errors': errors,
                'total_count': len(analysis_ids),
                'success_count': len(results),
                'error_count': len(errors)
            }
        )

    def cancel_all_tasks(self):
        """取消用户所有的任务"""
        try:
            # 获取用户所有的分析任务
            from ..models import OllamaImageAnalysis

            # 查询用户所有的任务，包括正在运行、等待中等状态
            user_tasks = OllamaImageAnalysis.objects.filter(
                media__user=self.viewset.request.user
            ).values_list('id', flat=True)

            if not user_tasks:
                return BaseResponseHandler.success_response(
                    message='没有找到需要取消的任务',
                    data={
                        'total_count': 0,
                        'cancelled_count': 0,
                        'error_count': 0
                    }
                )

            # 批量取消所有任务
            results = []
            errors = []

            for task_id in user_tasks:
                try:
                    result = self.task_manager.cancel_task(task_id, self.viewset.request.user)

                    if result['success']:
                        results.append({
                            'analysis_id': task_id,
                            'task_id': result['task_id']
                        })
                    else:
                        errors.append({
                            'analysis_id': task_id,
                            'error': result['error']
                        })

                except Exception as e:
                    errors.append({
                        'analysis_id': task_id,
                        'error': str(e)
                    })

            return BaseResponseHandler.success_response(
                message=f'取消所有任务完成: 成功 {len(results)} 个, 失败 {len(errors)} 个',
                data={
                    'cancelled_tasks': results,
                    'errors': errors,
                    'total_count': len(user_tasks),
                    'success_count': len(results),
                    'error_count': len(errors)
                }
            )

        except Exception as e:
            return BaseResponseHandler.error_response(
                message=f'取消所有任务失败: {str(e)}'
            )

    def _validate_model_for_user(self, model_name):
        """验证用户是否有权限使用指定模型"""
        try:
            from ..models import OllamaAIModel

            # 查找用户拥有的模型
            model = OllamaAIModel.objects.filter(
                endpoint__created_by=self.viewset.request.user,
                name=model_name,
                is_active=True,
                is_vision_capable=True
            ).first()

            if not model:
                return {
                    'valid': False,
                    'error': f'模型 "{model_name}" 不存在或不支持视觉分析'
                }

            return {'valid': True, 'model': model}

        except Exception as e:
            return {
                'valid': False,
                'error': f'验证模型失败: {str(e)}'
            }
    def _validate_concurrency_options(self, options):
        """验证并发控制选项"""
        errors = []

        # 验证并发数设置
        if 'max_concurrent' in options:
            max_concurrent = options['max_concurrent']
            if not isinstance(max_concurrent, int) or not 1 <= max_concurrent <= 20:
                errors.append('max_concurrent必须在1-20之间')

        # 验证并发模式开关
        if 'use_concurrency' in options:
            use_concurrency = options['use_concurrency']
            if not isinstance(use_concurrency, bool):
                errors.append('use_concurrency必须是布尔值')

        # 检查并发逻辑一致性
        use_concurrency = options.get('use_concurrency', False)
        max_concurrent = options.get('max_concurrent', None)

        # 如果启用了并发但没有指定最大并发数，给出警告
        if use_concurrency and max_concurrent is None:
            from django.conf import settings
            default_concurrent = getattr(settings, 'OLLAMA_DEFAULT_CONCURRENT', 3)
            options['max_concurrent'] = default_concurrent  # 自动设置默认值

        return errors
