"""
Django Async Manager 任务处理器
用于异步处理图片分析任务
"""
import logging
import requests
import base64
from typing import Dict, Any, Optional
from django.utils import timezone
from django.db import transaction
from django_async_manager import get_background_task

background_task = get_background_task()
from .models import AIAnalysis, AIModel, OllamaEndpoint
from media.models import Media, Category, Tag

logger = logging.getLogger(__name__)


@background_task(max_retries=3, retry_delay=60)
def analyze_image(analysis_id: int) -> Dict[str, Any]:
    """
    分析图片的主任务函数
    这个函数会被 django-async-manager 异步执行
    """
    logger.info(f"🚀 [TASK-{analysis_id}] 开始处理图片分析任务")

    try:
        # 获取分析记录并立即锁定模型名称
        with transaction.atomic():
            analysis = AIAnalysis.objects.select_for_update().select_related('media').get(id=analysis_id)
            initial_model = analysis.model_used
            logger.info(f"📋 [TASK-{analysis_id}] 获取分析记录成功: ID={analysis.id}, 媒体文件={analysis.media.file.name}")
            logger.info(f"🎯 [TASK-{analysis_id}] 锁定的初始模型名称: {initial_model}")

            # 更新状态为处理中，但不改变model_used字段
            analysis.status = 'processing'
            analysis.save(update_fields=['status'])
            logger.info(f"⏳ [TASK-{analysis_id}] 更新分析状态为处理中")

        # 获取媒体文件
        media = analysis.media
        logger.info(f"📁 [TASK-{analysis_id}] 媒体文件信息: ID={media.id}, 文件名={media.file.name}, 类型={media.file_type}, 大小={media.file.size if media.file else 'Unknown'} bytes")

        # 验证文件类型
        if media.file_type != 'image':
            logger.error(f"❌ [TASK-{analysis_id}] 文件类型不支持: {media.file_type}")
            raise ValueError(f"不支持的文件类型: {media.file_type}")

        # 获取指定的模型，如果没有指定则使用默认视觉模型
        model_name = initial_model  # 使用锁定的初始模型名称
        logger.info(f"🔍 [TASK-{analysis_id}] 使用锁定的模型名称: {model_name}")
        
        if model_name:
            try:
                model = AIModel.objects.get(name=model_name, is_active=True, is_vision_capable=True)
                logger.info(f"🎯 [TASK-{analysis_id}] 成功获取指定模型: {model_name} (ID: {model.id})")
            except AIModel.DoesNotExist:
                logger.warning(f"⚠️ [TASK-{analysis_id}] 指定模型不存在或不可用: {model_name}，回退到默认模型")
                model = AIModel.get_default_model()
                if not model:
                    logger.error(f"❌ [TASK-{analysis_id}] 未找到可用的AI视觉模型")
                    raise ValueError("没有找到可用的AI视觉模型")
                logger.info(f"🔄 [TASK-{analysis_id}] 回退到默认模型: {model.name}")
                # 重要：即使回退到默认模型，也要保持原始模型名称记录
                logger.warning(f"⚠️ [TASK-{analysis_id}] 注意：实际使用模型 {model.name}，但记录中保持原始模型名称 {model_name}")
        else:
            logger.warning(f"⚠️ [TASK-{analysis_id}] 分析记录中没有保存模型名称，使用默认模型")
            model = AIModel.get_default_model()
            if not model:
                logger.error(f"❌ [TASK-{analysis_id}] 未找到可用的AI视觉模型")
                raise ValueError("没有找到可用的AI视觉模型")
            logger.info(f"🔄 [TASK-{analysis_id}] 使用默认模型: {model.name}")
            # 更新记录中的模型名称为实际使用的默认模型
            with transaction.atomic():
                analysis_with_lock = AIAnalysis.objects.select_for_update().get(id=analysis_id)
                analysis_with_lock.model_used = model.name
                analysis_with_lock.save(update_fields=['model_used'])
            model_name = model.name

        # 获取端点
        endpoint = model.endpoint
        logger.info(f"🤖 [TASK-{analysis_id}] AI模型信息: 模型={model.name}, 端点={endpoint.url}, 端点名称={endpoint.name}")

        # 读取图片文件并编码
        logger.info(f"🖼️ [TASK-{analysis_id}] 开始读取图片文件: {media.file.path}")
        image_data = _encode_image(media.file.path)
        logger.info(f"✅ [TASK-{analysis_id}] 图片文件编码完成，Base64长度: {len(image_data)} 字符")

        # 获取分析选项
        options = analysis.analysis_options or {}
        logger.info(f"⚙️ [TASK-{analysis_id}] 分析选项配置: {options}")

        # 调用AI模型进行分析
        logger.info(f"📡 [TASK-{analysis_id}] 开始调用AI模型进行分析...")
        start_time = timezone.now()

        result = _call_ollama_api(
            endpoint_url=endpoint.url,
            model_name=model.name,
            image_data=image_data,
            media_file=media,
            options=options
        )

        end_time = timezone.now()
        duration = (end_time - start_time).total_seconds()
        logger.info(f"📡 [TASK-{analysis_id}] AI模型调用完成，耗时: {duration:.2f}秒")

        # 检查实际使用的模型名称
        logger.info(f"🔍 [TASK-{analysis_id}] 实际使用的模型: {model.name}")

        # 记录分析结果概要
        if result:
            title = result.get('title', '')[:50]
            description_length = len(result.get('description', ''))
            tags_count = len(result.get('tags', []))
            categories_count = len(result.get('categories', []))
            logger.info(f"📊 [TASK-{analysis_id}] 分析结果概要: 标题='{title}...', 描述长度={description_length}, 标签数量={tags_count}, 分类数量={categories_count}")
        else:
            logger.warning(f"⚠️ [TASK-{analysis_id}] AI返回空结果")

        # 处理分析结果
        logger.info(f"💾 [TASK-{analysis_id}] 开始保存分析结果到数据库...")

        # 使用锁定的原始模型名称
        original_model_name = initial_model
        logger.info(f"🔒 [TASK-{analysis_id}] 使用锁定的原始模型名称: {original_model_name}")

        # 传递原始模型名称给处理函数，确保不会被覆盖
        _process_analysis_result(analysis, result, original_model_name)

        # 最终验证
        final_check = AIAnalysis.objects.get(id=analysis_id)
        if final_check.model_used != original_model_name:
            logger.error(f"❌ [TASK-{analysis_id}] 最终验证失败！期望: {original_model_name}, 实际: {final_check.model_used}")
            # 使用原生SQL强制更新
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute(
                    "UPDATE llms_aianalysis SET model_used = %s WHERE id = %s",
                    [original_model_name, analysis_id]
                )
            logger.info(f"🔧 [TASK-{analysis_id}] 使用原生SQL强制修复模型名称")
        else:
            logger.info(f"✅ [TASK-{analysis_id}] 模型名称验证通过: {original_model_name}")

        logger.info(f"✅ [TASK-{analysis_id}] 分析结果保存完成，最终模型: {original_model_name}")

        logger.info(f"🎉 [TASK-{analysis_id}] 图片分析任务完成成功")

        return {
            'success': True,
            'analysis_id': analysis_id,
            'result': result
        }

    except Exception as e:
        logger.error(f"❌ [TASK-{analysis_id}] 图片分析任务失败: {str(e)}")
        logger.error(f"❌ [TASK-{analysis_id}] 错误详情: {type(e).__name__}: {str(e)}", exc_info=True)

        # 更新分析状态为失败
        try:
            analysis = AIAnalysis.objects.get(id=analysis_id)
            analysis.status = 'failed'
            analysis.error_message = str(e)
            analysis.analyzed_at = timezone.now()
            analysis.save()
            logger.info(f"📝 [TASK-{analysis_id}] 已更新分析状态为失败")
        except Exception as save_error:
            logger.error(f"❌ [TASK-{analysis_id}] 更新分析状态失败: {save_error}")

        logger.info(f"🏁 [TASK-{analysis_id}] 任务执行结束 (失败)")

        return {
            'success': False,
            'analysis_id': analysis_id,
            'error': str(e)
        }


def _encode_image(image_path: str) -> str:
    """将图片文件编码为base64"""
    try:
        logger.debug(f"📖 [ENCODE] 开始读取图片文件: {image_path}")
        with open(image_path, 'rb') as image_file:
            image_bytes = image_file.read()
            encoded_data = base64.b64encode(image_bytes).decode('utf-8')
            logger.debug(f"📖 [ENCODE] 图片编码完成: 原始大小={len(image_bytes)} bytes, 编码大小={len(encoded_data)} 字符")
            return encoded_data
    except Exception as e:
        logger.error(f"❌ [ENCODE] 图片文件读取失败: {image_path}, 错误: {str(e)}")
        raise ValueError(f"无法读取图片文件: {str(e)}")


def _call_ollama_api(endpoint_url: str, model_name: str, image_data: str, media_file: Media, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """调用Ollama API进行图片分析"""
    timeout = 300  # 5分钟超时

    logger.debug(f"🔧 [API] 开始构建API请求参数")

    # 构建分析提示词
    prompt = _build_analysis_prompt(media_file, options)
    logger.debug(f"💬 [API] 提示词长度: {len(prompt)} 字符")

    # API 请求数据
    payload = {
        "model": model_name,
        "prompt": prompt,
        "images": [image_data],
        "stream": False
    }

    api_url = f"{endpoint_url.rstrip('/')}/api/generate"
    logger.info(f"🌐 [API] 准备调用Ollama API: {api_url}")
    logger.debug(f"🌐 [API] 请求参数: 模型={model_name}, 超时={timeout}秒")

    try:
        logger.debug(f"📤 [API] 发送HTTP请求...")
        response = requests.post(
            api_url,
            json=payload,
            timeout=timeout
        )

        logger.info(f"📤 [API] API响应: 状态码={response.status_code}, 响应大小={len(response.content)} bytes")

        # 记录完整响应用于调试
        result = response.json()
        logger.debug(f"📤 [API] 原始响应数据: {result}")

        # 检查响应结构
        if 'response' in result:
            logger.info(f"📤 [API] 找到AI响应字段，响应长度: {len(result.get('response', ''))} 字符")
            logger.debug(f"📤 [API] AI响应前300字符: {result.get('response', '')[:300]}")
        else:
            logger.warning(f"📤 [API] 响应中没有找到'response'字段，响应结构: {list(result.keys())}")

        # 解析AI响应
        parsed_result = _parse_ai_response(result.get('response', ''))
        logger.info(f"📤 [API] AI响应解析完成，结果类型: {type(parsed_result)}")
        logger.debug(f"📤 [API] 解析结果概要: {list(parsed_result.keys()) if parsed_result else 'None'}")

        return parsed_result

    except requests.exceptions.Timeout as e:
        logger.error(f"⏰ [API] 请求超时 ({timeout}秒): {str(e)}")
        raise ValueError(f"AI模型调用超时: {str(e)}")
    except requests.exceptions.ConnectionError as e:
        logger.error(f"🔌 [API] 连接错误: {str(e)}")
        raise ValueError(f"无法连接到AI模型服务: {str(e)}")
    except requests.exceptions.HTTPError as e:
        logger.error(f"🌐 [API] HTTP错误: {str(e)}")
        raise ValueError(f"AI模型调用HTTP错误: {str(e)}")
    except requests.exceptions.RequestException as e:
        logger.error(f"❌ [API] 请求异常: {str(e)}")
        raise ValueError(f"AI模型调用失败: {str(e)}")
    except Exception as e:
        logger.error(f"❌ [API] 未知错误: {str(e)}")
        raise ValueError(f"AI模型调用失败: {str(e)}")


def _build_prompt_only_prompt(media_file: Media, analysis_result: Dict[str, Any]) -> str:
    """构建专门用于生成提示词的提示词"""

    title = analysis_result.get('title', '')
    description = analysis_result.get('description', '')

    prompt = f"""基于以下图片分析结果，请重新生成一个更专业的AI绘画提示词：

图片标题：{title}
图片描述：{description}

请生成一个详细的中文AI绘画提示词，要包含：
1. 主体特征和细节
2. 环境和背景
3. 色彩和光线
4. 艺术风格
5. 氛围和情感

只需要返回提示词内容，不需要JSON格式。"""

    return prompt


def _call_ollama_for_prompt_only(endpoint_url: str, model_name: str, image_data: str, prompt: str) -> str:
    """专门调用Ollama API生成提示词"""
    timeout = 300

    api_url = f"{endpoint_url.rstrip('/')}/api/generate"

    payload = {
        "model": model_name,
        "prompt": prompt,
        "images": [image_data],
        "stream": False
    }

    try:
        logger.info(f"🎨 [PROMPT] 开始专门生成提示词...")
        response = requests.post(api_url, json=payload, timeout=timeout)

        if response.status_code == 200:
            result = response.json()
            prompt_result = result.get('response', '').strip()
            logger.info(f"🎨 [PROMPT] 提示词生成完成，长度: {len(prompt_result)} 字符")
            return prompt_result
        else:
            logger.error(f"🎨 [PROMPT] API调用失败: {response.status_code}")
            return ""

    except Exception as e:
        logger.error(f"🎨 [PROMPT] 生成提示词失败: {str(e)}")
        return ""


def _build_analysis_prompt(media_file: Media, options: Optional[Dict[str, Any]] = None) -> str:
    """构建图片分析提示词"""
    # 默认选项
    default_options = {
        'generate_title': True,
        'generate_description': True,
        'generate_prompt': True,
        'generate_categories': True,
        'generate_tags': True,
        'max_categories': 5,
        'max_tags': 10
    }

    # 合并用户选项和默认选项
    if options:
        final_options = {**default_options, **options}
    else:
        final_options = default_options

    # 构建JSON结构示例（使用中文说明）
    json_structure_example = {}

    if final_options.get('generate_title', True):
        json_structure_example['title'] = "为图片生成一个简洁的中文标题"

    if final_options.get('generate_description', True):
        json_structure_example['description'] = "用中文详细描述图片内容、场景、对象和特征"

    if final_options.get('generate_prompt', True):
        json_structure_example['prompt'] = "生成适合用于AI绘画的中文提示词，包含画风、构图、色彩等要素"

    if final_options.get('generate_tags', True):
        max_tags = final_options.get('max_tags', 10)
        json_structure_example['tags'] = [f"中文标签{i+1}" for i in range(min(3, max_tags))]

    if final_options.get('generate_categories', True):
        max_categories = final_options.get('max_categories', 5)
        json_structure_example['categories'] = [f"中文分类{i+1}" for i in range(min(2, max_categories))]

    # 生成提示词
    prompt = f"""分析这张图片，并按照以下JSON格式返回结果：
{json_structure_example}

请用中文描述这张图片的提示词，包含内容、风格、色彩和氛围等要素。

当前文件名：{media_file.file.name}
当前已有描述：{media_file.description or '无'}

请返回有效的JSON格式。"""

    return prompt


def _parse_ai_response(response_text: str) -> Dict[str, Any]:
    """解析AI响应文本"""
    import json
    import re

    logger.info(f"🔍 [PARSE] 原始AI响应长度: {len(response_text)} 字符")
    logger.debug(f"🔍 [PARSE] 原始AI响应前500字符: {response_text[:500]}")

    try:
        # 尝试提取JSON
        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if json_match:
            json_str = json_match.group(0)
            logger.debug(f"🔍 [PARSE] 提取的JSON字符串: {json_str}")
            parsed_data = json.loads(json_str)
            logger.info(f"🔍 [PARSE] JSON解析成功: {parsed_data}")
            return parsed_data
        else:
            logger.warning(f"🔍 [PARSE] 未找到JSON格式，使用原始响应文本")
            # 如果没有找到JSON，创建基本响应
            return {
                'title': response_text[:100] + '...' if len(response_text) > 100 else response_text,
                'description': response_text,
                'prompt': response_text,
                'tags': [],
                'categories': []
            }
    except json.JSONDecodeError as e:
        logger.error(f"🔍 [PARSE] JSON解析失败: {e}, 响应内容: {response_text[:200]}")
        # JSON解析失败，创建基本响应
        return {
            'title': response_text[:100] + '...' if len(response_text) > 100 else response_text,
            'description': response_text,
            'prompt': response_text,
            'tags': [],
            'categories': []
        }


def _process_analysis_result(analysis: AIAnalysis, result: Dict[str, Any], original_model_name: str = None):
    """处理分析结果并保存到数据库"""
    try:
        with transaction.atomic():
            logger.info(f"💾 [PROCESS] 开始处理分析结果: analysis_id={analysis.id}")

            # 获取分析选项中的限制设置
            analysis_options = analysis.analysis_options or {}
            max_categories = analysis_options.get('max_categories', 5)
            max_tags = analysis_options.get('max_tags', 10)

            logger.info(f"💾 [PROCESS] 分析限制: max_categories={max_categories}, max_tags={max_tags}")

            # 保存分析结果
            title = result.get('title', '').strip()
            description = result.get('description', '').strip()
            prompt = result.get('prompt', '').strip()
            tag_names = result.get('tags', [])
            category_names = result.get('categories', [])

            # 强制限制标签和分类数量
            if len(tag_names) > max_tags:
                logger.warning(f"💾 [PROCESS] 标签数量超限: {len(tag_names)} > {max_tags}, 截取前{max_tags}个")
                tag_names = tag_names[:max_tags]

            if len(category_names) > max_categories:
                logger.warning(f"💾 [PROCESS] 分类数量超限: {len(category_names)} > {max_categories}, 截取前{max_categories}个")
                category_names = category_names[:max_categories]
            
            logger.info(f"💾 [PROCESS] 分析结果数据: title='{title}', description_length={len(description)}, prompt_length={len(prompt)}")
            logger.info(f"💾 [PROCESS] 标签({len(tag_names)}个): {tag_names}, 分类({len(category_names)}个): {category_names}")
            logger.info(f"💾 [PROCESS] 原始模型名称: {original_model_name}, 当前记录模型名称: {analysis.model_used}")
            
            # 使用select_for_update锁定记录，防止并发修改
            locked_analysis = AIAnalysis.objects.select_for_update().get(id=analysis.id)
            
            locked_analysis.title = title
            locked_analysis.description = description
            locked_analysis.prompt = prompt

            # 重要：确保model_used字段不会被覆盖
            if original_model_name:
                locked_analysis.model_used = original_model_name
                logger.info(f"💾 [PROCESS] 强制设置模型名称为: {original_model_name}")

            logger.info(f"💾 [PROCESS] 保存初步分析记录...")
            logger.info(f"💾 [PROCESS] 初步分析结果:")
            logger.info(f"  - 标题: {title}")
            logger.info(f"  - 描述长度: {len(description)} 字符")
            logger.info(f"  - 初始提示词长度: {len(prompt)} 字符")
            logger.info(f"  - 标签数量: {len(tag_names)} 个")
            logger.info(f"  - 分类数量: {len(category_names)} 个")

            locked_analysis.save()
            logger.info(f"💾 [PROCESS] 初步分析记录保存成功: id={locked_analysis.id}")

            # 第二阶段：专门优化提示词
            logger.info(f"🎨 [PROCESS] 开始第二阶段：优化提示词...")
            try:
                # 获取模型端点URL
                from .models import AIModel
                ai_model = AIModel.objects.filter(name=original_model_name).first()
                if ai_model:
                    endpoint_url = ai_model.endpoint.url
                    # 重新编码图片
                    image_path = analysis.media.file.path
                    image_data = _encode_image(image_path)

                    # 构建专门用于提示词的提示词
                    prompt_only_prompt = _build_prompt_only_prompt(analysis.media, {
                        'title': title,
                        'description': description
                    })

                    # 调用API生成新的提示词
                    optimized_prompt = _call_ollama_for_prompt_only(
                        endpoint_url,
                        original_model_name,
                        image_data,
                        prompt_only_prompt
                    )

                    if optimized_prompt:
                        logger.info(f"🎨 [PROCESS] 提示词优化成功，原长度={len(prompt)}, 新长度={len(optimized_prompt)}")
                        locked_analysis.prompt = optimized_prompt
                        prompt = optimized_prompt  # 更新本地变量
                    else:
                        logger.warning(f"🎨 [PROCESS] 提示词优化失败，使用原始提示词")
                else:
                    logger.warning(f"🎨 [PROCESS] 未找到模型配置，跳过提示词优化")
            except Exception as e:
                logger.error(f"🎨 [PROCESS] 提示词优化过程出错: {str(e)}", exc_info=True)

            locked_analysis.status = 'completed'
            locked_analysis.analyzed_at = timezone.now()

            logger.info(f"💾 [PROCESS] 最终保存分析记录...")
            locked_analysis.save()
            logger.info(f"💾 [PROCESS] 分析记录保存成功: id={locked_analysis.id}, status={locked_analysis.status}, model_used={locked_analysis.model_used}")
            
            # 更新analysis引用以使用锁定后的对象
            analysis = locked_analysis

            # 获取用户ID用于创建标签和分类
            user_id = analysis.media.user_id

            # 处理标签
            if tag_names:
                logger.info(f"💾 [PROCESS] 处理标签: {tag_names}")
                tags = []
                for tag_name in tag_names:
                    tag, created = Tag.objects.get_or_create(
                        name=tag_name.strip(),
                        user_id=user_id
                    )
                    tags.append(tag)
                    logger.info(f"💾 [PROCESS] 标签 '{tag_name}': {'创建新标签' if created else '使用现有标签'}")
                analysis.suggested_tags.add(*tags)
                logger.info(f"💾 [PROCESS] 标签添加完成，数量: {len(tags)}")
            else:
                logger.info(f"💾 [PROCESS] 没有标签需要处理")

            # 处理分类
            if category_names:
                logger.info(f"💾 [PROCESS] 处理分类: {category_names}")
                categories = []
                for category_name in category_names:
                    category, created = Category.objects.get_or_create(
                        name=category_name.strip(),
                        user_id=user_id
                    )
                    categories.append(category)
                    logger.info(f"💾 [PROCESS] 分类 '{category_name}': {'创建新分类' if created else '使用现有分类'}")
                analysis.suggested_categories.add(*categories)
                logger.info(f"💾 [PROCESS] 分类添加完成，数量: {len(categories)}")
            else:
                logger.info(f"💾 [PROCESS] 没有分类需要处理")

            # 记录应用前的媒体文件状态
            logger.info(f"💾 [PROCESS] 应用前媒体文件: title='{analysis.media.title}', has_description={bool(analysis.media.description)}, has_prompt={bool(analysis.media.prompt)}")
            logger.info(f"💾 [PROCESS] 应用前媒体文件分类数量: {analysis.media.categories.count()}, 标签数量: {analysis.media.tags.count()}")

            # 自动应用到媒体文件
            logger.info(f"💾 [PROCESS] 开始应用分析结果到媒体文件...")
            apply_result = analysis.apply_to_media()
            logger.info(f"💾 [PROCESS] 应用结果: {apply_result}")

            # 记录应用后的媒体文件状态
            logger.info(f"💾 [PROCESS] 应用后媒体文件: title='{analysis.media.title}', has_description={bool(analysis.media.description)}, has_prompt={bool(analysis.media.prompt)}")
            logger.info(f"💾 [PROCESS] 应用后媒体文件分类数量: {analysis.media.categories.count()}, 标签数量: {analysis.media.tags.count()}")

            logger.info(f"💾 [PROCESS] 分析结果处理完成: {analysis.media.file.name}")

    except Exception as e:
        logger.error(f"💾 [PROCESS] 保存分析结果失败: {str(e)}", exc_info=True)
        raise


def create_analysis_task(media_id: int, user_id: int, model_name: Optional[str] = None, options: Optional[Dict[str, Any]] = None) -> AIAnalysis:
    """
    创建图片分析任务

    Args:
        media_id: 媒体文件ID
        user_id: 用户ID
        model_name: 指定的模型名称（可选）
        options: 分析选项（可选）

    Returns:
        AIAnalysis: 分析记录对象
    """
    logger.info(f"🎯 [CREATE] 开始创建图片分析任务: media_id={media_id}, user_id={user_id}, model_name={model_name}, options={options}")

    try:
        with transaction.atomic():
            # 获取媒体文件
            media = Media.objects.get(id=media_id, user_id=user_id)
            logger.info(f"📁 [CREATE] 获取媒体文件成功: ID={media.id}, 文件名={media.file.name}, 类型={media.file_type}")

            if media.file_type != 'image':
                logger.error(f"❌ [CREATE] 不支持的文件类型: {media.file_type}")
                raise ValueError("只支持分析图片文件")

            # 使用select_for_update确保原子性操作
            analysis, created = AIAnalysis.objects.select_for_update().get_or_create(
                media=media,
                defaults={
                    'status': 'pending',
                    'model_used': model_name,
                    'analysis_options': options,
                }
            )

            if created:
                logger.info(f"✨ [CREATE] 创建新分析记录: ID={analysis.id}, model_used={analysis.model_used}")
            else:
                logger.info(f"🔄 [CREATE] 重用现有分析记录: ID={analysis.id}, 原模型={analysis.model_used}")
                # 如果已存在，重置状态并更新选项
                analysis.status = 'pending'
                analysis.error_message = None
                analysis.task_id = None
                analysis.model_used = model_name  # 更新模型名称
                analysis.analysis_options = options
                logger.info(f"🔄 [CREATE] 准备更新模型: {analysis.model_used} -> {model_name}")
                analysis.save(update_fields=['status', 'error_message', 'task_id', 'model_used', 'analysis_options'])
                logger.info(f"🔄 [CREATE] 保存后重新检查: 模型={analysis.model_used}")
                logger.info(f"🔄 [CREATE] 已重置分析状态并更新选项，模型={model_name}")

            # 使用 django-async-manager 启动任务
            logger.info(f"⚡ [CREATE] 准备启动异步任务函数...")
            # 直接调用后台任务函数
            task_instance = analyze_image(analysis.id)

            # 保存任务ID，但不改变其他字段
            analysis.task_id = str(task_instance.id)
            analysis.save(update_fields=['task_id'])
            logger.info(f"✅ [CREATE] 任务ID保存成功: task_id={analysis.task_id}")
            logger.info(f"🎉 [CREATE] 图片分析任务创建完成: media_id={media_id}, task_id={analysis.task_id}, model_used={analysis.model_used}")

            return analysis

    except Exception as e:
        logger.error(f"❌ [CREATE] 创建分析任务失败: {str(e)}", exc_info=True)
        raise


def get_task_status(task_id: str) -> Dict[str, Any]:
    """获取任务状态"""
    try:
        from django_async_manager import get_task
        Task = get_task()
        logger.info(f"🔍 [STATUS] 查询任务状态: task_id={task_id}")

        try:
            task = Task.objects.get(id=task_id)
            logger.info(f"🔍 [STATUS] 找到任务: status={task.status}, attempts={task.attempts}/{task.max_retries}")

            # 根据django-async-manager的实际状态映射
            if task.status == 'pending':
                result = {
                    'status': 'pending',
                    'progress': 0,
                    'is_task_running': False
                }
            elif task.status == 'in_progress':
                result = {
                    'status': 'processing',
                    'progress': 50,
                    'is_task_running': True
                }
            elif task.status == 'completed':
                result = {
                    'status': 'completed',
                    'progress': 100,
                    'is_task_running': False
                }
            elif task.status == 'failed':
                error_msg = 'Task failed'
                if task.last_errors and len(task.last_errors) > 0:
                    error_msg = task.last_errors[-1]
                result = {
                    'status': 'failed',
                    'progress': 0,
                    'is_task_running': False,
                    'error': error_msg
                }
            elif task.status == 'canceled':
                result = {
                    'status': 'failed',
                    'progress': 0,
                    'is_task_running': False,
                    'error': 'Task was canceled'
                }
            else:
                # 处理未知状态
                result = {
                    'status': 'processing' if task.attempts > 0 else 'pending',
                    'progress': 25 if task.attempts > 0 else 0,
                    'is_task_running': task.status not in ['completed', 'failed', 'canceled']
                }

            logger.info(f"🔍 [STATUS] 返回状态映射: {result}")
            return result

        except Task.DoesNotExist:
            logger.warning(f"🔍 [STATUS] 任务不存在: task_id={task_id}")
            return {
                'status': 'not_found',
                'progress': 0,
                'is_task_running': False,
                'error': 'Task not found'
            }

    except Exception as e:
        logger.error(f"🔍 [STATUS] 获取任务状态失败: {str(e)}", exc_info=True)
        return {
            'status': 'error',
            'progress': 0,
            'is_task_running': False,
            'error': str(e)
        }
