"""
图片分析视图处理器
提供图片分析任务的创建、查询、管理等功能
"""

from rest_framework.decorators import action
from .base import BaseResponseHandler, BaseViewSetMixin
from ..serializers import (
    OllamaImageAnalysisCreateSerializer,
    OllamaImageAnalysisTaskCreateSerializer,
    OllamaImageAnalysisTaskStatusSerializer,
    OllamaImageAnalysisTaskListSerializer,
    OllamaImageAnalysisTaskRetrySerializer,
    OllamaImageAnalysisTaskCancelSerializer
)
from ..tasks.manager import OllamaTaskManager


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
                endpoint__created_by=self.request.user,
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
        self.request = viewset_instance.request
        self.task_manager = OllamaTaskManager()

    def batch_create_tasks(self):
        """批量创建分析任务"""
        media_ids = self.request.data.get('media_ids', [])
        model_name = self.request.data.get('model_name')
        options = self.request.data.get('options', {})
        prompt = self.request.data.get('prompt')

        # 验证输入参数
        if not isinstance(media_ids, list) or not media_ids:
            return BaseResponseHandler.error_response(
                message='media_ids 必须是非空数组'
            )

        if len(media_ids) > 20:  # 限制批量大小
            return BaseResponseHandler.error_response(
                message='单次批量操作最多支持20个文件'
            )

        # 验证模型（如果有指定）
        if model_name:
            model_validation = self._validate_model_for_user(model_name)
            if not model_validation['valid']:
                return BaseResponseHandler.error_response(
                    message=model_validation['error']
                )

        # 批量创建任务
        results = []
        errors = []

        for media_id in media_ids:
            try:
                result = self.task_manager.create_task(
                    user=self.request.user,
                    media_id=media_id,
                    model_name=model_name,
                    analysis_options=options,
                    prompt=prompt
                )

                if result['success']:
                    results.append({
                        'media_id': media_id,
                        'analysis_id': result['analysis_id'],
                        'task_id': result['task_id'],
                        'status': result['status']
                    })
                else:
                    errors.append({
                        'media_id': media_id,
                        'error': result['error']
                    })

            except Exception as e:
                errors.append({
                    'media_id': media_id,
                    'error': str(e)
                })

        return BaseResponseHandler.success_response(
            message=f'批量任务创建完成: 成功 {len(results)} 个, 失败 {len(errors)} 个',
            data={
                'created_tasks': results,
                'errors': errors,
                'total_count': len(media_ids),
                'success_count': len(results),
                'error_count': len(errors)
            }
        )

    def batch_cancel_tasks(self):
        """批量取消任务"""
        analysis_ids = self.request.data.get('analysis_ids', [])

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
                result = self.task_manager.cancel_task(analysis_id, self.request.user)

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

    def _validate_model_for_user(self, model_name):
        """验证用户是否有权限使用指定模型"""
        try:
            from ..models import OllamaAIModel

            # 查找用户拥有的模型
            model = OllamaAIModel.objects.filter(
                endpoint__created_by=self.request.user,
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