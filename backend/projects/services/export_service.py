"""
LoRA 训练数据集导出服务

将项目中的图片和对应的描述打包成 ZIP 文件，用于 LoRA 训练
"""

import os
import logging
import zipfile
import tempfile
from io import BytesIO
from pathlib import Path
from django.http import HttpResponse

from ..models import Project, ProjectMedia
from llm.models import ImageAnalysis, AnalysisStatus

logger = logging.getLogger(__name__)


class LoraExportService:
    """LoRA 训练数据集导出服务"""

    @staticmethod
    def export_project_lora_dataset(project: Project, trigger_word: str = None) -> HttpResponse:
        """
        导出项目的 LoRA 训练数据集

        Args:
            project: 项目实例
            trigger_word: 可选的触发词，会在描述前添加

        Returns:
            HttpResponse: ZIP 文件下载响应
        """
        # 获取项目中所有媒体
        project_media_qs = ProjectMedia.objects.filter(
            project=project
        ).select_related('media').order_by('order', '-added_at')

        if not project_media_qs.exists():
            raise ValueError("项目中没有媒体文件")

        # 获取所有媒体ID
        media_ids = [pm.media_id for pm in project_media_qs]

        # 获取已完成的分析记录
        analyses = ImageAnalysis.objects.filter(
            media_id__in=media_ids,
            status=AnalysisStatus.COMPLETED
        ).select_related('media').order_by('-created_at')

        # 去重，每个媒体只取最新的分析
        media_analysis_map = {}
        for analysis in analyses:
            if analysis.media_id not in media_analysis_map:
                media_analysis_map[analysis.media_id] = analysis

        # 创建 ZIP 文件
        buffer = BytesIO()
        exported_count = 0
        skipped_count = 0

        with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for project_media in project_media_qs:
                media = project_media.media

                # 生成文件名（去除扩展名）
                file_stem = Path(media.filename).stem
                # 使用序号避免重名
                safe_filename = f"{exported_count + 1:04d}_{file_stem}"

                # 1. 添加图片文件
                try:
                    if media.file and hasattr(media.file, 'path') and os.path.exists(media.file.path):
                        # 获取原始扩展名
                        file_ext = Path(media.filename).suffix or '.jpg'
                        zip_file.write(
                            media.file.path,
                            f"{safe_filename}{file_ext}"
                        )
                    else:
                        # 如果文件不存在，跳过
                        skipped_count += 1
                        logger.warning(f"媒体文件不存在: {media.filename}")
                        continue
                except Exception as e:
                    logger.error(f"添加图片文件失败: {media.filename}, error: {e}")
                    skipped_count += 1
                    continue

                # 2. 添加描述文本文件（如果有分析结果）
                if media.id in media_analysis_map:
                    analysis = media_analysis_map[media.id]
                    description = analysis.description or ""
                    if description.strip():
                        # 如果有触发词，在描述前添加
                        if trigger_word:
                            final_description = f"{trigger_word} {description}"
                        else:
                            final_description = description
                        zip_file.writestr(f"{safe_filename}.txt", final_description)

                exported_count += 1

        if exported_count == 0:
            raise ValueError("没有可导出的训练数据")

        # 准备响应
        buffer.seek(0)
        response = HttpResponse(
            buffer.getvalue(),
            content_type='application/zip'
        )
        response['Content-Disposition'] = f'attachment; filename="{project.name}_lora_dataset.zip"'

        logger.info(
            f"LoRA数据集导出完成: project={project.name}, "
            f"exported={exported_count}, skipped={skipped_count}, "
            f"trigger_word={trigger_word or 'None'}"
        )

        return response

    @staticmethod
    def get_export_stats(project: Project) -> dict:
        """
        获取项目的导出统计信息

        Args:
            project: 项目实例

        Returns:
            dict: 统计信息
        """
        project_media_qs = ProjectMedia.objects.filter(project=project)
        total_count = project_media_qs.count()

        if total_count == 0:
            return {
                'total': 0,
                'exportable': 0,
                'no_analysis': 0,
                'analysis_incomplete': 0,
                'no_description': 0,
            }

        media_ids = [pm.media_id for pm in project_media_qs]

        # 获取已完成的分析
        completed_analyses = ImageAnalysis.objects.filter(
            media_id__in=media_ids,
            status=AnalysisStatus.COMPLETED
        ).values('media_id', 'description')

        # 去重统计
        media_with_completed = set()
        media_with_description = set()

        for analysis in completed_analyses:
            media_with_completed.add(analysis['media_id'])
            if analysis['description'] and analysis['description'].strip():
                media_with_description.add(analysis['media_id'])

        no_analysis = total_count - len(media_with_completed)
        analysis_incomplete = len(media_with_completed) - len(media_with_description)

        return {
            'total': total_count,
            'exportable': len(media_with_description),
            'no_analysis': no_analysis,
            'analysis_incomplete': analysis_incomplete,
            'no_description': len(media_with_completed) - len(media_with_description),
        }
