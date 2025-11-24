"""
Ollama图片分析器
负责与Ollama API交互进行图片分析
"""
import logging
import time
import base64
import requests
import re
from typing import Dict, Any
from django.conf import settings
from .prompt_templates import AnalysisPromptTemplates, TaskTypeConfig
from .concurrency_controller import concurrency_controller

logger = logging.getLogger(__name__)


class OllamaImageAnalyzer:
    """Ollama图片分析器"""

    def __init__(self):
        self.timeout = getattr(settings, 'OLLAMA_ANALYSIS_TIMEOUT', 300)

    def analyze(self, analysis) -> Dict[str, Any]:
        """执行图片分析"""
        start_time = time.time()

        try:
            # 验证输入
            self._validate_input(analysis)

            # 获取分析选项
            options = analysis.analysis_options

            # 强制使用多请求分析模式
            results = {}
            failed_tasks = []

            # 根据用户选项确定需要执行的分析任务
            enabled_tasks = TaskTypeConfig.get_enabled_tasks(options)

            # 如果没有指定任何选项，使用默认分析
            if not enabled_tasks:
                enabled_tasks = TaskTypeConfig.get_default_tasks()

            # 生成任务列表
            tasks = []
            for task_type in enabled_tasks:
                prompt = TaskTypeConfig.get_task_prompt(
                    task_type,
                    options.get(f'max_{task_type}') if task_type in ['categories', 'tags'] else None
                )
                tasks.append((task_type, prompt))

            # 根据用户选项决定是否使用并发执行
            use_concurrency = options.get('use_concurrency', False)

            if use_concurrency and len(tasks) > 1:
                # 并发执行模式
                logger.info(f"使用并发模式执行 {len(tasks)} 个任务")
                concurrent_result = concurrency_controller.execute_tasks_concurrently(
                    tasks=tasks,
                    analysis=analysis,
                    executor_callback=self._prepare_single_analysis
                )
                results = concurrent_result['results']
                failed_tasks = concurrent_result['failed_tasks']

                logger.info(f"并发执行完成: 成功 {len(results)} 个，失败 {len(failed_tasks)} 个")
            else:
                # 串行执行模式（原有逻辑）
                execution_mode = "并发模式" if use_concurrency else "串行模式"
                logger.info(f"使用{execution_mode}执行 {len(tasks)} 个任务")

                for task_name, task_prompt in tasks:
                    try:
                        data = self._prepare_single_analysis(analysis, task_prompt)
                        api_result = self._call_api(analysis.model.endpoint.url, analysis.model.name, data)

                        if api_result['success']:
                            task_result = self._process_single_result(api_result['response'], task_name)
                            results[task_name] = task_result
                            logger.info(f"成功完成 {task_name} 分析")
                        else:
                            failed_tasks.append(f"{task_name}: {api_result['error']}")
                            logger.error(f"{task_name} 分析失败: {api_result['error']}")

                    except Exception as e:
                        failed_tasks.append(f"{task_name}: {str(e)}")
                        logger.error(f"{task_name} 分析异常: {str(e)}")

            # 汇总结果
            final_result = self._combine_results(results, options)

            processing_time = int((time.time() - start_time) * 1000)

            # 如果所有任务都失败了
            if not results and failed_tasks:
                return {
                    'success': False,
                    'error': f'所有分析任务都失败了: {"; ".join(failed_tasks)}'
                }

            return {
                'success': True,
                'result': final_result,
                'processing_time_ms': processing_time,
                'model_used': analysis.model.name,
                'endpoint_used': analysis.model.endpoint.name,
                'partial_results': results,
                'failed_tasks': failed_tasks if failed_tasks else None
            }

        except Exception as e:
            logger.error(f"图片分析异常: {str(e)}")
            return {'success': False, 'error': f'分析异常: {str(e)}'}

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

    def _prepare_single_analysis(self, analysis, prompt):
        """为单个分析任务准备数据"""
        # 读取并编码图片
        analysis.media.file.seek(0)
        image_content = analysis.media.file.read()
        image_base64 = base64.b64encode(image_content).decode('utf-8')
        analysis.media.file.seek(0)

        return {
            'image': image_base64,
            'prompt': prompt,
            'options': {
                'temperature': analysis.analysis_options.get('temperature', 0.7),
                'top_p': analysis.analysis_options.get('top_p', 0.9),
                'max_tokens': analysis.analysis_options.get('max_tokens', 300),  # 降低单个任务的token数量
                'stream': False
            }
        }

    
    def _call_api(self, endpoint_url: str, model_name: str, data: Dict) -> Dict:
        """调用Ollama API"""
        api_url = f"{endpoint_url.rstrip('/')}/api/generate"

        request_data = {
            'model': model_name,
            'prompt': data['prompt'],
            'images': [data['image']],
            'stream': False,
            'options': data['options']
        }

        logger.info(f"调用Ollama API: model={model_name}")

        try:
            response = requests.post(
                api_url,
                json=request_data,
                timeout=self.timeout,
                headers={'Content-Type': 'application/json'}
            )

            if response.status_code == 200:
                api_response = response.json()
                logger.info(f"Ollama API响应成功: model={model_name}")
                return {
                    'success': True,
                    'response': api_response
                }
            else:
                error_msg = f"API请求失败: HTTP {response.status_code}"
                logger.error(f"Ollama API错误: {error_msg}")
                return {'success': False, 'error': error_msg}

        except requests.exceptions.Timeout:
            error_msg = "API请求超时"
            logger.error(f"Ollama API超时: {error_msg}")
            return {'success': False, 'error': error_msg}
        except requests.exceptions.ConnectionError:
            error_msg = "无法连接到Ollama服务"
            logger.error(f"Ollama API连接错误: {error_msg}")
            return {'success': False, 'error': error_msg}
        except Exception as e:
            error_msg = f"API调用异常: {str(e)}"
            logger.error(f"Ollama API异常: {error_msg}")
            return {'success': False, 'error': error_msg}

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

        elif task_type == 'prompt':
            # 提取AI绘画提示词：主要文本内容
            lines = response_text.split('\n')
            prompt_lines = []
            for line in lines:
                line = line.strip()
                if line and not line.startswith(('标题：', 'Title:', '描述：', 'Description:')):
                    prompt_lines.append(line)
            return ' '.join(prompt_lines)[:300]  # 限制长度

        return response_text

    def _combine_results(self, results: Dict[str, Any], options: Dict[str, Any]) -> Dict[str, Any]:
        """汇总多个分析任务的结果"""
        combined = {
            'title': '',
            'description': '',
            'categories': [],
            'tags': [],
            'prompt': '',
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

        if 'prompt' in results:
            combined['prompt'] = results['prompt']
        elif options.get('generate_prompt'):
            combined['prompt'] = ''

        return combined

    