"""
Ollama图片分析客户端 - 使用LangChain重构
简化实现，利用LangChain的异步支持和并发管理
"""
import base64
import logging
import time
from typing import Dict, Any, List, Optional
from django.conf import settings
from django.core.cache import cache
from langchain_core.messages import HumanMessage
from langchain_core.runnables import RunnableParallel, RunnableLambda
from langchain_core.output_parsers import StrOutputParser
from langchain_core.language_models.chat_models import BaseChatModel
from .prompt_templates import PromptTemplates, TaskConfig

logger = logging.getLogger(__name__)


class LangChainImageAnalyzer:
    """基于LangChain的图片分析器"""

    def __init__(self):
        self.timeout = getattr(settings, 'OLLAMA_ANALYSIS_TIMEOUT', 300)
        self.image_cache_ttl = 600  # 图片缓存10分钟

    def analyze_parallel(self, analysis) -> Dict[str, Any]:
        """
        并行执行单张图片的所有分析任务
        使用LangChain的RunnableParallel进行并发处理
        """
        try:
            # 验证输入
            self._validate_input(analysis)

            # 提取分析数据
            analysis_data = self._extract_analysis_data(analysis)

            # 获取需要执行的任务
            enabled_tasks = TaskConfig.get_enabled_tasks(analysis_data['options'])
            if not enabled_tasks:
                enabled_tasks = TaskConfig.get_default_tasks()

            # 准备图片数据（带缓存）
            image_base64 = self._get_cached_image_data(analysis)

            # 获取LangChain客户端
            client = self._get_langchain_client(analysis_data['endpoint_url'], analysis_data['model_name'])

            # 获取用户自定义提示词（如果有）
            custom_prompt = getattr(analysis, 'prompt', None)

            # 构建并行任务链
            parallel_chain = self._build_parallel_chain(client, enabled_tasks, analysis_data['options'], custom_prompt)

            # 执行并行分析
            start_time = time.time()
            results = parallel_chain.invoke({
                "image_base64": image_base64,
                "image_path": analysis.media.file.path
            })

            # Debug: 打印并行执行结果
            logger.info(f"=== AI原始响应结果 ===")
            for task_type, result in results.items():
                logger.info(f"Task {task_type}: type={type(result)}, value={result}")
                # 如果是字符串，记录长度
                if isinstance(result, str):
                    logger.info(f"  - 字符串长度: {len(result)}")
                    logger.info(f"  - 前100字符: {result[:100]}")
            logger.info(f"=== 响应结果结束 ===")

            # 处理结果
            return self._process_results(results, enabled_tasks, analysis, start_time)

        except Exception as e:
            logger.error(f"并行分析失败: {str(e)}")
            return {'success': False, 'error': f'分析失败: {str(e)}'}

    def _get_langchain_client(self, endpoint_url: str, model_name: str) -> BaseChatModel:
        """获取LangChain客户端"""
        from ollama.clients.client_factory import ClientFactory
        from ollama.models import OllamaEndpoint

        # 获取端点信息
        endpoint = OllamaEndpoint.objects.get(url=endpoint_url)

        # 创建客户端
        client = ClientFactory.create_client(endpoint)
        if not client:
            raise ValueError(f"无法创建 {endpoint.provider} 客户端")

        # 返回LangChain模型实例
        return client.get_langchain_model(model_name)

    def _build_parallel_chain(self, client: BaseChatModel, tasks: List[str], options: Dict[str, Any], custom_prompt: Optional[str] = None):
        """构建并行分析链"""
        chain_dict = {}

        for task_type in tasks:
            # 创建任务特定的提示词
            prompt = self._create_task_prompt(task_type, options, custom_prompt)

            # 创建分析链
            chain = (
                {
                    "image_base64": lambda x: x["image_base64"],
                    "prompt": lambda x: prompt,
                    "image_path": lambda x: x["image_path"]
                }
                | RunnableLambda(lambda x: self._prepare_messages(x))
                | client
                | StrOutputParser()
                | RunnableLambda(lambda x: self._process_single_result(x, task_type))
            )

            chain_dict[task_type] = chain

        # 创建并行链
        return RunnableParallel(**chain_dict)

    def _prepare_messages(self, inputs: Dict[str, Any]) -> List[HumanMessage]:
        """准备LangChain消息"""
        return [
            HumanMessage(
                content=[
                    {
                        "type": "text",
                        "text": inputs["prompt"]
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{inputs['image_base64']}"
                        }
                    }
                ]
            )
        ]

    def _create_task_prompt(self, task_type: str, options: Dict[str, Any], custom_prompt: Optional[str] = None) -> str:
        """创建任务特定的提示词"""
        # 如果有自定义提示词，优先使用
        if custom_prompt:
            logger.info(f"Task: {task_type}, 使用自定义提示词: {custom_prompt[:200]}...")
            return custom_prompt

        # 否则使用默认的模板提示词
        prompt = TaskConfig.get_task_prompt(
            task_type,
            options.get(f'max_{task_type}') if task_type in ['categories', 'tags'] else None
        )
        # 添加调试日志
        logger.info(f"Task: {task_type}, 提示词: {prompt}")
        return prompt

    def _get_cached_image_data(self, analysis) -> str:
        """获取或缓存图片数据"""
        cache_key = f'image_b64_{analysis.media.id}'

        # 尝试从缓存获取
        cached = cache.get(cache_key)
        if cached:
            return cached

        # 读取并编码图片
        analysis.media.file.seek(0)
        image_content = analysis.media.file.read()
        image_base64 = base64.b64encode(image_content).decode('utf-8')
        analysis.media.file.seek(0)

        # 缓存结果
        cache.set(cache_key, image_base64, timeout=self.image_cache_ttl)
        return image_base64

    def _extract_analysis_data(self, analysis) -> Dict[str, Any]:
        """提取分析所需的数据"""
        # 如果 model 为 None，尝试获取默认端点和模型
        if not analysis.model:
            from ollama.models import OllamaEndpoint, OllamaAIModel
            try:
                # 获取用户的默认端点
                default_endpoint = OllamaEndpoint.objects.filter(
                    created_by=analysis.media.uploaded_by,
                    is_default=True,
                    is_active=True
                ).first()

                if not default_endpoint:
                    raise ValueError("未找到活跃的默认端点")

                # 获取默认模型（必须支持视觉）
                default_model = OllamaAIModel.objects.filter(
                    endpoint=default_endpoint,
                    is_active=True,
                    is_vision_capable=True
                ).first()

                if not default_model:
                    raise ValueError("端点中没有支持图片分析的模型")

                endpoint_url = default_endpoint.url
                model_name = default_model.name
            except Exception as e:
                logger.error(f"无法获取默认模型: {str(e)}")
                raise ValueError(f"分析配置错误: {str(e)}")
        else:
            endpoint_url = analysis.model.endpoint.url
            model_name = analysis.model.name

        return {
            'options': dict(analysis.analysis_options) if analysis.analysis_options else {},
            'endpoint_url': endpoint_url,
            'model_name': model_name,
            'media_id': analysis.media.id,
        }

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

    def _process_single_result(self, response_text, task_type: str):
        """处理单个任务的分析结果"""
        # 处理列表格式的响应（某些模型的特殊响应）
        if isinstance(response_text, list):
            # 对于所有任务类型，如果返回的是列表，先转换成字符串
            response_text = ' '.join(str(item) for item in response_text)
        else:
            # 确保是字符串
            response_text = str(response_text).strip()

        # 处理智谱AI思考模型的响应格式
        answer_markers = ['现在回答：', '现在:', '最终答案：', '最终:', '答案是：', '答案:']
        for marker in answer_markers:
            if marker in response_text:
                parts = response_text.split(marker)
                if len(parts) > 1:
                    response_text = parts[-1].strip()
                    break

        # 清理思考过程
        if ('用户现在需要' in response_text or '现在需要' in response_text) and len(response_text) > 200:
            lines = response_text.split('\n')
            final_lines = []
            for line in reversed(lines):
                line = line.strip()
                if not line:
                    continue
                if any(keyword in line for keyword in ['用户现在需要', '现在需要', '首先看', '然后', '接下来']):
                    continue
                if (len(line) > 5 and
                    not any(keyword in line for keyword in ['需要', '请', '要求', '长度', '避免', '包含', '客观'])):
                    final_lines.insert(0, line)
                elif final_lines:
                    break

            if final_lines:
                response_text = '\n'.join(final_lines[:3])

        # 根据任务类型处理不同的响应格式
        if task_type == 'title':
            # 检查是否是逗号分隔的词语（错误格式）
            if ',' in response_text and len(response_text.split(',')) > 3:
                # 如果是很多词用逗号分隔，取前几个作为标题
                words = [w.strip() for w in response_text.split(',')[:5]]
                return ' '.join(words)

            # 提取标题
            lines = response_text.split('\n')
            title = ''
            for line in lines:
                line = line.strip()
                if line and not line.startswith(('标题：', '标题:', 'Title:', '用户现在需要', '现在')):
                    title = line
                    break

            for prefix in ['标题：', '标题:', 'Title:', 'title:']:
                if title.startswith(prefix):
                    title = title[len(prefix):].strip()
            return title[:50]

        elif task_type == 'description':
            # 检查是否是简短的词列表（错误格式）
            words = response_text.split()
            if len(words) <= 15 and len(words) > 0 and len(response_text) < 100:
                # 可能是词列表，转换为描述
                if '、' in response_text or ',' in response_text:
                    # 如果是用顿号或逗号分隔的词
                    separators = ['、', ',', ' ']
                    items = []
                    for sep in separators:
                        if sep in response_text:
                            items = [item.strip() for item in response_text.split(sep) if item.strip()]
                            break
                    if len(items) > 3:
                        # 组合成更自然的描述
                        desc = f"图片中包含了{items[0]}"
                        if len(items) > 1:
                            desc += f"、{items[1]}"
                        if len(items) > 2:
                            desc += f"等元素"
                        # 尝试推断场景
                        if any(word in response_text for word in ['男子', '男性', '女人', '女性']):
                            desc += "，画面中有人物"
                        if any(word in response_text for word in ['室外', '户外', '自然光']):
                            desc += "，场景位于室外"
                        return desc + "。"
                    elif len(items) > 1:
                        return f"这是一张展示{'、'.join(items[:-1])}和{items[-1]}的图片。"
                return f"这是一张展示{response_text}的图片。"

            # 提取描述
            lines = response_text.split('\n')
            description_lines = []
            for line in lines:
                line = line.strip()
                if (line and
                    not line.startswith(('标题：', 'Tags:', '分类：')) and
                    not any(word in line for word in ['用户现在需要', '需要', '请', '要求', '长度', '避免'])):
                    description_lines.append(line)
            return ' '.join(description_lines)[:500]

        elif task_type in ['categories', 'tags']:
            # 提取列表
            result = []
            if ',' in response_text:
                result = [item.strip() for item in response_text.split(',')]
            else:
                lines = response_text.split('\n')
                result = [line.strip() for line in lines if line.strip()]

            # 过滤和清理
            filtered_result = []
            for item in result:
                import re
                item = re.sub(r'^\d+[\.\)]\s*', '', item)
                for prefix in ['标签：', 'Tags:', '分类：', 'Categories:', '- ', '• ']:
                    if item.startswith(prefix):
                        item = item[len(prefix):].strip()
                if item and len(item) <= 20:
                    filtered_result.append(item)

            return filtered_result

        return response_text

    def _process_results(self, results: Dict[str, Any], enabled_tasks: List[str], analysis, start_time: float) -> Dict[str, Any]:
        """处理并行结果"""
        processed_results = {}
        failed_tasks = []

        for task_type in enabled_tasks:
            if task_type in results and results[task_type]:
                try:
                    # 确保结果不是嵌套的
                    result = results[task_type]

                    # 处理可能的嵌套列表（LangChain 有时会返回嵌套结构）
                    if isinstance(result, list) and len(result) == 1 and isinstance(result[0], list):
                        result = result[0]

                    # 根据任务类型处理结果
                    if task_type in ['categories', 'tags']:
                        # 对于 tags 和 categories，确保是字符串列表
                        if isinstance(result, list):
                            result = [str(item) for item in result if item]
                        else:
                            result = [str(result)]
                    else:
                        # 对于 title 和 description，确保是字符串
                        # 注意：_process_single_result 已经处理了列表情况，这里只需要确保是字符串
                        if isinstance(result, list):
                            # 理论上不应该到这里，但以防万一
                            result = ' '.join(str(r) for r in result)
                        else:
                            result = str(result)

                    logger.debug(f"Processed {task_type} result: {type(result)} - {result}")
                    processed_results[task_type] = result
                except Exception as e:
                    logger.error(f"Error processing {task_type}: {str(e)}")
                    failed_tasks.append(f"{task_type}: 结果处理失败 - {str(e)}")
            else:
                failed_tasks.append(f"{task_type}: 无返回结果")

        # 汇总结果
        final_result = self._combine_results(processed_results, analysis.analysis_options)
        processing_time = int((time.time() - start_time) * 1000)

        return {
            'success': len(processed_results) > 0,
            'result': final_result,
            'processing_time_ms': processing_time,
            'model_used': analysis.model.name if analysis.model else 'default',
            'endpoint_used': analysis.model.endpoint.name if analysis.model else 'default',
            'partial_results': processed_results,
            'failed_tasks': failed_tasks if failed_tasks else None
        }

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

    # 向后兼容的同步方法
    def analyze(self, analysis) -> Dict[str, Any]:
        """向后兼容的同步分析"""
        return self.analyze_parallel(analysis)


# 保持向后兼容的别名
OllamaImageAnalyzer = LangChainImageAnalyzer