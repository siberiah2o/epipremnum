"""
Ollama图片分析客户端 - 增强版（线程安全版本）
支持单图片内4个分析并行执行，适配Django同步环境
"""
import asyncio
import aiohttp
import base64
import logging
import time
import threading
import re
import concurrent.futures
from typing import Dict, Any
from django.conf import settings
from django.core.cache import cache
from .prompt_templates import PromptTemplates, TaskConfig

logger = logging.getLogger(__name__)

class EnhancedOllamaImageAnalyzer:
    """增强版Ollama图片分析器 - 线程安全版本"""

    def __init__(self):
        self.timeout = getattr(settings, 'OLLAMA_ANALYSIS_TIMEOUT', 300)
        self.max_parallel_tasks = 4  # 每张图片并行执行的任务数
        self.image_cache_ttl = 600   # 图片缓存10分钟
        self.thread_pool = concurrent.futures.ThreadPoolExecutor(
            max_workers=10,
            thread_name_prefix="ollama_async_"
        )

    def analyze_parallel(self, analysis) -> Dict[str, Any]:
        """
        并行执行单张图片的所有分析任务 - 线程安全版本
        使用线程池执行异步代码
        """
        # 在线程池中执行异步代码
        future = self.thread_pool.submit(self._run_analyze_parallel, analysis)
        try:
            return future.result(timeout=self.timeout)
        except Exception as e:
            logger.error(f"并行分析线程执行失败: {str(e)}")
            return {'success': False, 'error': f'并行分析失败: {str(e)}'}

    def _run_analyze_parallel(self, analysis):
        """在线程中运行异步分析"""
        # 创建一个新的事件循环（每个线程独立）
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(self._analyze_parallel_async(analysis))
        finally:
            loop.close()

    async def _analyze_parallel_async(self, analysis) -> Dict[str, Any]:
        """异步并行分析主方法"""
        start_time = time.time()

        try:
            # 预先提取所有需要的数据，避免在异步上下文中访问模型
            loop = asyncio.get_event_loop()

            # 在线程中提取所有模型数据
            analysis_data = await loop.run_in_executor(None, self._extract_analysis_data, analysis)

            # 在线程中执行验证
            await loop.run_in_executor(None, self._validate_input, analysis)

            # 获取需要执行的任务
            enabled_tasks = TaskConfig.get_enabled_tasks(analysis_data['options'])
            if not enabled_tasks:
                enabled_tasks = TaskConfig.get_default_tasks()

            # 准备图片数据（带缓存）
            image_base64 = await self._get_cached_image_data(analysis)

            # 准备所有任务
            tasks = []
            for task_type in enabled_tasks:
                prompt = TaskConfig.get_task_prompt(
                    task_type,
                    analysis_data['options'].get(f'max_{task_type}') if task_type in ['categories', 'tags'] else None
                )

                tasks.append(self._call_ollama_api_async(
                    analysis_data['endpoint_url'],
                    analysis_data['model_name'],
                    prompt,
                    image_base64,
                    task_type,
                    analysis_data['options']
                ))

            # 并行执行所有任务
            semaphore = asyncio.Semaphore(self.max_parallel_tasks)
            async_tasks = []
            for task in tasks:
                async_tasks.append(self._execute_with_semaphore(task, semaphore))

            results = await asyncio.gather(*async_tasks, return_exceptions=True)

            # 处理结果
            return self._process_parallel_results(results, enabled_tasks, analysis, start_time)

        except Exception as e:
            import traceback
            logger.error(f"并行分析异常: {str(e)}")
            logger.error(f"异常堆栈: {traceback.format_exc()}")
            return {'success': False, 'error': f'并行分析异常: {str(e)}'}

    async def _get_cached_image_data(self, analysis):
        """获取缓存的图片数据"""
        cache_key = f'image_b64_{analysis.media.id}'

        # 在线程中执行缓存操作，避免异步冲突
        loop = asyncio.get_event_loop()

        def get_cache():
            return cache.get(cache_key)

        cached = await loop.run_in_executor(None, get_cache)

        if cached:
            return cached

        # 读取并编码图片 - 使用线程池执行文件读取操作
        image_base64 = await loop.run_in_executor(
            None,  # 使用默认线程池
            self._read_and_encode_image,
            analysis
        )

        # 缓存结果 - 也在线程中执行
        def set_cache():
            cache.set(cache_key, image_base64, timeout=self.image_cache_ttl)

        await loop.run_in_executor(None, set_cache)
        return image_base64

    def _read_and_encode_image(self, analysis):
        """同步读取和编码图片"""
        analysis.media.file.seek(0)
        image_content = analysis.media.file.read()
        image_base64 = base64.b64encode(image_content).decode('utf-8')
        analysis.media.file.seek(0)
        return image_base64

    def _extract_analysis_data(self, analysis):
        """提取分析所需的数据，避免在异步上下文中访问模型"""
        return {
            'options': dict(analysis.analysis_options) if analysis.analysis_options else {},
            'endpoint_url': analysis.model.endpoint.url,
            'model_name': analysis.model.name,
            'media_id': analysis.media.id,
        }

    async def _call_ollama_api_async(self, endpoint_url, model_name, prompt, image_data, task_type, options):
        """异步调用Ollama API"""
        api_url = f"{endpoint_url.rstrip('/')}/api/generate"

        request_data = {
            'model': model_name,
            'prompt': prompt,
            'images': [image_data],
            'stream': False,
            'options': {
                'temperature': options.get('temperature', 0.7),
                'top_p': options.get('top_p', 0.9),
                'max_tokens': 300
            }
        }

        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=self.timeout)) as session:
                async with session.post(api_url, json=request_data) as response:
                    if response.status == 200:
                        result = await response.json()
                        return {
                            'task_type': task_type,
                            'success': True,
                            'response': result.get('response', '')
                        }
                    else:
                        return {
                            'task_type': task_type,
                            'success': False,
                            'error': f"HTTP {response.status}"
                        }
        except Exception as e:
            return {
                'task_type': task_type,
                'success': False,
                'error': str(e)
            }

    async def _execute_with_semaphore(self, task, semaphore):
        """带信号量限制执行任务"""
        async with semaphore:
            return await task

    def _process_parallel_results(self, results, enabled_tasks, analysis, start_time):
        """处理并行结果"""
        processed_results = {}
        failed_tasks = []

        for result in results:
            if isinstance(result, Exception):
                task_type = getattr(result, 'task_type', 'unknown')
                failed_tasks.append(f"{task_type}: {str(result)}")
                continue

            if result['success']:
                try:
                    task_result = self._process_single_result(
                        result['response'],
                        result['task_type']
                    )
                    processed_results[result['task_type']] = task_result
                except Exception as e:
                    failed_tasks.append(f"{result['task_type']}: 结果处理失败 - {str(e)}")
            else:
                failed_tasks.append(f"{result['task_type']}: {result.get('error', '未知错误')}")

        # 汇总结果
        final_result = self._combine_results(processed_results, analysis.analysis_options)
        processing_time = int((time.time() - start_time) * 1000)

        return {
            'success': len(processed_results) > 0,
            'result': final_result,
            'processing_time_ms': processing_time,
            'model_used': analysis.model.name,
            'endpoint_used': analysis.model.endpoint.name,
            'partial_results': processed_results,
            'failed_tasks': failed_tasks if failed_tasks else None
        }

    # 保留向后兼容的同步方法
    def analyze(self, analysis) -> Dict[str, Any]:
        """向后兼容的同步分析"""
        return self.analyze_parallel(analysis)

    def _validate_input(self, analysis):
        """验证输入"""
        if not analysis.media or not analysis.media.file:
            raise Exception('媒体文件不存在')

        if not analysis.model or not analysis.model.is_vision_capable:
            raise Exception('模型不支持视觉分析')

        if not analysis.model.endpoint.is_active:
            raise Exception('模型端点未激活')

        # 检查是否为图片文件
        image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff'}
        file_extension = analysis.media.file.name.lower().split('.')[-1]
        if f'.{file_extension}' not in image_extensions:
            raise Exception('只支持图片文件分析')

    
    def _process_single_result(self, response_text: str, task_type: str) -> str:
        """处理单个任务的分析结果"""
        response_text = response_text.strip()

        # 根据任务类型处理不同的响应格式
        if task_type == 'title':
            # 提取标题：取第一行或前50字符
            lines = response_text.split('\n')
            title = lines[0].strip()
            # 去掉可能的标题前缀
            for prefix in ['标题：', '标题:', 'Title:', 'title:']:
                if title.startswith(prefix):
                    title = title[len(prefix):].strip()
            return title[:50]  # 限制长度

        elif task_type == 'description':
            # 提取描述：清理格式，主要文本内容
            lines = response_text.split('\n')
            description_lines = []
            for line in lines:
                line = line.strip()
                if line and not line.startswith(('标题：', 'Title:', '标签：', 'Tags:', '分类：', 'Categories:')):
                    description_lines.append(line)
            return ' '.join(description_lines)[:500]  # 限制长度

        elif task_type in ['categories', 'tags']:
            # 提取标签/分类：处理逗号分隔的列表
            result = []
            # 尝试按逗号分隔
            if ',' in response_text:
                result = [item.strip() for item in response_text.split(',')]
            else:
                # 按行分割
                lines = response_text.split('\n')
                result = [line.strip() for line in lines if line.strip()]

            # 过滤无效项
            filtered_result = []
            for item in result:
                # 去掉可能的序号前缀
                item = re.sub(r'^\d+[\.\)]\s*', '', item)
                # 去掉可能的标签前缀
                for prefix in ['标签：', 'Tags:', '分类：', 'Categories:', '- ', '• ']:
                    if item.startswith(prefix):
                        item = item[len(prefix):].strip()
                if item and len(item) <= 20:  # 合理长度限制
                    filtered_result.append(item)

            return filtered_result


        return response_text

    def _combine_results(self, results: Dict[str, Any], options: Dict[str, Any]) -> Dict[str, Any]:
        """汇总多个分析任务的结果"""
        combined = {
            'title': '',
            'description': '',
            'categories': [],
            'tags': [],
            'analysis_options': options
        }

        # 合并结果
        if 'title' in results:
            combined['title'] = results['title']
        elif options.get('generate_title'):
            combined['title'] = '标题分析失败'

        if 'description' in results:
            combined['description'] = results['description']
        elif options.get('generate_description'):
            combined['description'] = '描述分析失败'

        if 'categories' in results:
            combined['categories'] = results['categories']
        elif options.get('generate_categories'):
            combined['categories'] = []

        if 'tags' in results:
            combined['tags'] = results['tags']
        elif options.get('generate_tags'):
            combined['tags'] = []


        return combined


# 更新全局实例
OllamaImageAnalyzer = EnhancedOllamaImageAnalyzer