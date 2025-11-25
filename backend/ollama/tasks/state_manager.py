"""
原子状态管理器
提供数据库事务保护和原子性状态操作
"""

import logging
import time
import random
from typing import Dict, Any, Optional, List
from django.db import transaction, models, DatabaseError
from django.db.models import F, Q
from django.core.cache import cache
from django.utils import timezone

logger = logging.getLogger(__name__)


class StateManager:
    """原子状态管理器"""

    def __init__(self):
        self.cache_timeout = 30  # 30秒缓存超时，提高实时性
        self.max_retries = 3  # 最大重试次数
        self.base_delay = 0.1  # 基础延迟时间（秒）

    def _retry_with_backoff(self, func, *args, **kwargs):
        """
        带指数退避的重试机制
        主要用于处理数据库锁定问题
        """
        for attempt in range(self.max_retries + 1):
            try:
                return func(*args, **kwargs)
            except DatabaseError as e:
                if "database is locked" in str(e).lower() and attempt < self.max_retries:
                    # 指数退避 + 随机抖动，避免惊群效应
                    delay = self.base_delay * (2 ** attempt) + random.uniform(0, 0.1)
                    logger.warning(f"🔄 数据库锁定，第 {attempt + 1} 次重试，等待 {delay:.2f}s: {str(e)}")
                    time.sleep(delay)
                    continue
                else:
                    # 重试次数用完或不是锁定错误，直接抛出
                    logger.error(f"❌ 数据库操作失败，已达最大重试次数: {str(e)}")
                    raise
            except Exception as e:
                # 非数据库错误，直接抛出
                raise

    @transaction.atomic
    def create_analysis_safely(self, media, model, analysis_options, prompt=None):
        """原子性创建分析任务"""
        from ..models import OllamaImageAnalysis

        # 使用 select_for_update 防止竞态条件
        media_lock = media.__class__.objects.select_for_update().get(id=media.id)

        # 检查是否已有进行中的任务（允许重复分析已完成任务）
        existing_analysis = OllamaImageAnalysis.objects.filter(
            media=media_lock,
            model=model,
            analysis_options=analysis_options,
            status__in=['pending', 'processing']  # 只检查进行中的任务
        ).select_for_update().first()

        if existing_analysis:
            logger.info(f"发现已有进行中的分析任务: {existing_analysis.id}")
            return existing_analysis, False  # 返回现有任务， False表示未创建新任务

        # 原子性创建新任务
        analysis = OllamaImageAnalysis.objects.create(
            media=media_lock,
            model=model,
            analysis_options=analysis_options,
            prompt=prompt,
            status='pending'  # 确保初始状态正确
        )

        logger.info(f"✅ 原子性创建分析任务: {analysis.id}")
        return analysis, True  # 返回新创建的任务， True表示创建了新任务

    def update_analysis_status(self, analysis_id: int, from_status: Optional[str], to_status: str, **kwargs) -> bool:
        """原子性更新分析状态（带重试机制）"""
        from ..models import OllamaImageAnalysis

        def _do_update():
            with transaction.atomic():
                # 使用 select_for_update 锁定记录避免死锁
                analysis = OllamaImageAnalysis.objects.select_for_update(skip_locked=False).get(id=analysis_id)

                # 增强状态检查逻辑
                current_status = analysis.status
                
                # 如果指定了源状态，检查当前状态是否匹配
                if from_status:
                    if isinstance(from_status, str):
                        if current_status != from_status:
                            logger.warning(f"状态不匹配: analysis_id={analysis_id}, "
                                         f"current={current_status}, expected={from_status}")
                            return False
                    elif isinstance(from_status, list):
                        if current_status not in from_status:
                            logger.warning(f"状态不在预期范围内: analysis_id={analysis_id}, "
                                         f"current={current_status}, expected={from_status}")
                            return False

                # 更严格的状态转换验证
                if not self._is_valid_status_transition(current_status, to_status):
                    # 特殊处理：如果目标状态是cancelled或failed，允许从任何状态转换
                    if to_status not in ['cancelled', 'failed']:
                        logger.error(f"无效的状态转换: analysis_id={analysis_id}, "
                                   f"{current_status} -> {to_status}")
                        return False
                    else:
                        logger.warning(f"强制状态转换（取消/失败）: analysis_id={analysis_id}, "
                                     f"{current_status} -> {to_status}")

                # 更新状态和附加字段
                old_status = analysis.status
                analysis.status = to_status

                # 更新时间戳
                current_time = timezone.now()
                if to_status == 'processing' and not analysis.started_at:
                    analysis.started_at = current_time
                elif to_status in ['completed', 'failed', 'cancelled'] and not analysis.completed_at:
                    analysis.completed_at = current_time

                # 更新其他字段
                for key, value in kwargs.items():
                    if hasattr(analysis, key):
                        setattr(analysis, key, value)

                # 计算处理时间
                if to_status == 'completed':
                    processing_time_ms = kwargs.get('processing_time')
                    if processing_time_ms is not None:
                        analysis.processing_time = processing_time_ms
                        logger.debug(f"使用传入的处理时间: {processing_time_ms}ms, analysis_id={analysis_id}")
                    elif analysis.started_at:
                        calculated_time = int((current_time - analysis.started_at).total_seconds() * 1000)
                        analysis.processing_time = calculated_time
                        logger.debug(f"计算的处理时间: {calculated_time}ms, analysis_id={analysis_id}")
                    else:
                        analysis.processing_time = 0
                        logger.warning(f"无法计算处理时间，started_at为空，设置为0, analysis_id={analysis_id}")

                # 确保处理时间不为None
                if to_status == 'completed' and not analysis.processing_time:
                    analysis.processing_time = int((current_time - analysis.started_at).total_seconds() * 1000) if analysis.started_at else 0
                    logger.warning(f"处理时间为空，重新计算: {analysis.processing_time}ms, analysis_id={analysis_id}")

                analysis.save()

                # 清除相关缓存
                self._clear_analysis_cache(analysis_id)

                logger.info(f"✅ 状态更新成功: analysis_id={analysis_id}, "
                           f"{old_status} -> {to_status}")
                return True

        try:
            return self._retry_with_backoff(_do_update)
        except Exception as e:
            logger.error(f"❌ 状态更新失败: analysis_id={analysis_id}, error={str(e)}")
            return False

    def batch_update_status(self, analysis_ids: List[int], from_status: Optional[str], to_status: str, **kwargs) -> Dict[str, int]:
        """批量原子性更新状态（带重试机制）"""
        from ..models import OllamaImageAnalysis

        def _do_batch_update():
            with transaction.atomic():
                # 优化：先获取当前状态，用于日志记录
                current_statuses = dict(
                    OllamaImageAnalysis.objects.filter(id__in=analysis_ids)
                    .values_list('id', 'status')
                )
                
                # 构建查询条件
                queryset = OllamaImageAnalysis.objects.filter(id__in=analysis_ids)

                if from_status:
                    if isinstance(from_status, str):
                        queryset = queryset.filter(status=from_status)
                    elif isinstance(from_status, list):
                        queryset = queryset.filter(status__in=from_status)

                # 更灵活的状态转换逻辑
                if to_status == 'cancelled':
                    # 允许从 pending 或 processing 状态取消
                    if not from_status:  # 如果没有指定源状态，则过滤
                        queryset = queryset.filter(status__in=['pending', 'processing'])
                elif to_status == 'processing':
                    # 只能从 pending 状态开始处理
                    if not from_status:  # 如果没有指定源状态，则过滤
                        queryset = queryset.filter(status='pending')
                elif to_status == 'failed':
                    # 可以从任何状态标记为失败，不额外过滤
                    pass
                elif to_status == 'completed':
                    # 只能从 processing 状态完成
                    if not from_status:  # 如果没有指定源状态，则过滤
                        queryset = queryset.filter(status='processing')

                # 准备更新数据
                update_data = {'status': to_status}
                current_time = timezone.now()

                if to_status == 'processing':
                    update_data['started_at'] = current_time
                elif to_status in ['completed', 'failed', 'cancelled']:
                    update_data['completed_at'] = current_time

                # 添加其他更新字段
                update_data.update(kwargs)

                # 执行批量更新
                updated_count = queryset.update(**update_data)

                # 优化：记录详细的状态转换信息
                if updated_count < len(analysis_ids):
                    # 找出未更新的记录 - 修复：应该检查哪些记录实际被更新了
                    actually_updated_ids = set(
                        OllamaImageAnalysis.objects.filter(id__in=analysis_ids, status=to_status)
                        .values_list('id', flat=True)
                    )
                    not_updated_ids = set(analysis_ids) - actually_updated_ids
                    
                    for analysis_id in not_updated_ids:
                        current_status = current_statuses.get(analysis_id, 'unknown')
                        logger.warning(f"批量更新跳过: analysis_id={analysis_id}, "
                                     f"current_status={current_status}, target_status={to_status}")

                # 清除缓存
                for analysis_id in analysis_ids:
                    self._clear_analysis_cache(analysis_id)

                logger.info(f"✅ 批量状态更新完成: 成功 {updated_count}/{len(analysis_ids)} 个, "
                           f"状态: {from_status or '*'} -> {to_status}")

                return {
                    'success_count': updated_count,
                    'error_count': len(analysis_ids) - updated_count
                }

        try:
            return self._retry_with_backoff(_do_batch_update)
        except Exception as e:
            logger.error(f"❌ 批量状态更新失败: error={str(e)}")
            return {'success_count': 0, 'error_count': len(analysis_ids)}

    def _is_valid_status_transition(self, from_status: str, to_status: str) -> bool:
        """验证状态转换是否有效"""
        valid_transitions = {
            'pending': ['processing', 'cancelled', 'failed'],
            'processing': ['completed', 'failed', 'cancelled'],
            'completed': [],  # 已完成不能转换
            'failed': ['pending'],  # 失败可以重试
            'cancelled': []  # 已取消不能转换
        }

        # 优化：允许特殊情况下的状态转换
        # 如果目标状态是cancelled或failed，允许从任何状态转换（用于强制取消或标记失败）
        if to_status in ['cancelled', 'failed']:
            return True
            
        return to_status in valid_transitions.get(from_status, [])

    def _clear_analysis_cache(self, analysis_id: int):
        """清除分析任务相关缓存"""
        cache_keys = [
            f'analysis_status_{analysis_id}',
            f'analysis_details_{analysis_id}',
            f'user_task_counts_*',  # 用户任务统计缓存
        ]

        for key in cache_keys:
            if key.endswith('*'):
                # 模糊匹配删除 - Django缓存可能不支持keys方法，使用简单的删除
                try:
                    cache.delete(key.replace('*', ''))
                except:
                    pass  # 忽略删除失败
            else:
                cache.delete(key)

    @transaction.atomic
    def increment_retry_count(self, analysis_id: int) -> bool:
        """原子性增加重试次数"""
        from ..models import OllamaImageAnalysis

        try:
            with transaction.atomic():
                analysis = OllamaImageAnalysis.objects.select_for_update().get(id=analysis_id)

                if analysis.retry_count >= 3:  # 最大重试次数限制
                    logger.warning(f"分析任务已达最大重试次数: analysis_id={analysis_id}")
                    return False

                analysis.retry_count = F('retry_count') + 1
                analysis.save()

                # 重新获取对象以获取更新后的值
                analysis.refresh_from_db()
                logger.info(f"🔄 重试次数更新: analysis_id={analysis_id}, retry_count={analysis.retry_count}")
                return True

        except Exception as e:
            logger.error(f"❌ 更新重试次数失败: analysis_id={analysis_id}, error={str(e)}")
            return False

    def update_media_with_analysis_result(self, analysis, result: Dict[str, Any]) -> bool:
        """原子性更新媒体分析结果（使用重试机制）"""
        from media.models import Media, Category, Tag

        def _do_update():
            with transaction.atomic():
                # 锁定媒体记录
                media = Media.objects.select_for_update().get(id=analysis.media.id)

                # 更新媒体字段
                if result.get('title'):
                    media.title = result['title'][:200]  # 限制长度

                if result.get('description'):
                    media.description = result['description'][:1000]  # 限制长度

                if result.get('prompt'):
                    media.prompt = result['prompt'][:500]  # 限制长度

                # 处理分类
                if result.get('categories') and isinstance(result['categories'], list):
                    # 获取或创建分类对象
                    category_objects = []
                    for cat_name in result['categories'][:10]:  # 限制数量
                        if isinstance(cat_name, str):
                            category, created = Category.objects.get_or_create(
                                name=cat_name[:100],  # 限制长度
                                user=media.user,
                                defaults={'description': f'自动生成的分类: {cat_name}'}
                            )
                            category_objects.append(category)
                    
                    # 设置分类关系
                    media.categories.set(category_objects)

                # 处理标签
                if result.get('tags') and isinstance(result['tags'], list):
                    # 获取或创建标签对象
                    tag_objects = []
                    for tag_name in result['tags'][:20]:  # 限制数量
                        if isinstance(tag_name, str):
                            tag, created = Tag.objects.get_or_create(
                                name=tag_name[:50],  # 限制长度
                                user=media.user,
                                defaults={}
                            )
                            tag_objects.append(tag)
                    
                    # 设置标签关系
                    media.tags.set(tag_objects)

                # 更新时间戳
                media.save()

                logger.info(f"✅ 媒体分析结果更新成功: media_id={media.id}")
                return True

        try:
            return self._retry_with_backoff(_do_update)
        except Exception as e:
            logger.error(f"❌ 更新媒体分析结果失败: media_id={analysis.media.id}, error={str(e)}")
            return False

    def get_user_task_statistics(self, user_id: int) -> Dict[str, Any]:
        """获取用户任务统计（实时数据）"""
        try:
            from ..models import OllamaImageAnalysis

            # 使用聚合查询获取统计信息
            stats = OllamaImageAnalysis.objects.filter(
                media__user_id=user_id
            ).values('status').annotate(
                count=models.Count('id')
            )

            # 构建统计字典
            result = {
                'pending': 0,
                'processing': 0,
                'completed': 0,
                'failed': 0,
                'cancelled': 0,
                'total': 0
            }

            for stat in stats:
                status = stat['status']
                count = stat['count']
                if status in result:
                    result[status] = count
                result['total'] += count

            # 添加其他统计信息
            result['processing_time_avg'] = self._get_avg_processing_time(user_id)
            result['last_activity'] = self._get_last_activity_time(user_id)

            return result

        except Exception as e:
            logger.error(f"❌ 获取用户统计失败: user_id={user_id}, error={str(e)}")
            return {}

    def _get_avg_processing_time(self, user_id: int) -> float:
        """获取平均处理时间"""
        try:
            from ..models import OllamaImageAnalysis

            avg_time = OllamaImageAnalysis.objects.filter(
                media__user_id=user_id,
                status='completed',
                processing_time__isnull=False
            ).aggregate(
                avg_time=models.Avg('processing_time')
            )['avg_time']

            return round(avg_time or 0, 2)
        except:
            return 0.0

    def _get_last_activity_time(self, user_id: int) -> Optional[timezone.datetime]:
        """获取最后活动时间"""
        try:
            from ..models import OllamaImageAnalysis

            last_analysis = OllamaImageAnalysis.objects.filter(
                media__user_id=user_id
            ).order_by('-created_at').first()

            return last_analysis.created_at if last_analysis else None
        except:
            return None

    @transaction.atomic
    def cleanup_old_analyses(self, days_old: int = 30) -> Dict[str, int]:
        """清理旧的分析记录"""
        from ..models import OllamaImageAnalysis

        try:
            cutoff_date = timezone.now() - timezone.timedelta(days=days_old)

            with transaction.atomic():
                # 获取要删除的记录数量
                old_count = OllamaImageAnalysis.objects.filter(
                    created_at__lt=cutoff_date,
                    status__in=['completed', 'failed', 'cancelled']
                ).count()

                if old_count == 0:
                    logger.info(f"没有需要清理的旧分析记录（{days_old}天前）")
                    return {'deleted_count': 0}

                # 删除旧记录
                deleted_count, _ = OllamaImageAnalysis.objects.filter(
                    created_at__lt=cutoff_date,
                    status__in=['completed', 'failed', 'cancelled']
                ).delete()

                logger.info(f"✅ 清理完成: 删除了 {deleted_count} 个旧分析记录")
                return {'deleted_count': deleted_count}

        except Exception as e:
            logger.error(f"❌ 清理旧分析记录失败: error={str(e)}")
            return {'deleted_count': 0, 'error': str(e)}


# 全局状态管理器实例
state_manager = StateManager()