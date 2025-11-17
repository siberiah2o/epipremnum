import json
import base64
from unittest.mock import patch, Mock
from django.test import TestCase, TransactionTestCase
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from media.models import Media, Category, Tag
from .models import AIAnalysis, OllamaModel, BatchAnalysisJob
from .services import OllamaClient, ImageAnalyzer, AIAnalysisService, OllamaAPIError

User = get_user_model()


class OllamaClientTest(TestCase):
    """Ollama客户端测试"""

    def setUp(self):
        self.client = OllamaClient()

    @patch('requests.post')
    def test_generate_response_success(self, mock_post):
        """测试生成响应成功"""
        mock_response = Mock()
        mock_response.json.return_value = {
            'response': '这是一个测试响应',
            'done': True
        }
        mock_response.raise_for_status.return_value = None
        mock_post.return_value = mock_response

        result = self.client.generate_response(
            model_name='llava',
            prompt='测试提示'
        )

        self.assertEqual(result['response'], '这是一个测试响应')
        mock_post.assert_called_once()

    @patch('requests.post')
    def test_generate_response_failure(self, mock_post):
        """测试生成响应失败"""
        mock_post.side_effect = Exception('连接失败')

        with self.assertRaises(OllamaAPIError):
            self.client.generate_response(
                model_name='llava',
                prompt='测试提示'
            )

    @patch('requests.get')
    def test_list_models_success(self, mock_get):
        """测试获取模型列表成功"""
        mock_response = Mock()
        mock_response.json.return_value = {
            'models': [
                {'name': 'llava', 'size': '4.7GB'},
                {'name': 'llava-v1.5', 'size': '4.7GB'}
            ]
        }
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        models = self.client.list_models()
        self.assertEqual(len(models), 2)
        self.assertEqual(models[0]['name'], 'llava')


class ImageAnalyzerTest(TestCase):
    """图片分析器测试"""

    def setUp(self):
        self.analyzer = ImageAnalyzer()

    def test_encode_image_to_base64(self):
        """测试图片编码"""
        # 创建一个简单的测试图片
        test_image_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01'

        with patch('builtins.open', create=True) as mock_open:
            mock_file = Mock()
            mock_file.read.return_value = test_image_data
            mock_open.return_value.__enter__.return_value = mock_file

            result = self.analyzer.encode_image_to_base64('test_path.png')

            # 验证结果是有效的base64字符串
            decoded = base64.b64decode(result)
            self.assertEqual(decoded, test_image_data)

    def test_parse_analysis_response_json(self):
        """测试解析JSON格式的分析响应"""
        response_text = '''
        这是一段分析文本
        {
            "title": "美丽的风景",
            "description": "这是一张美丽的自然风景照片",
            "prompt": "风景, 自然, 美丽",
            "categories": ["自然", "风景"],
            "tags": ["美丽", "自然", "户外"]
        }
        其他文本
        '''

        result = self.analyzer._parse_analysis_response(response_text)

        self.assertEqual(result['title'], '美丽的风景')
        self.assertEqual(result['description'], '这是一张美丽的自然风景照片')
        self.assertEqual(result['prompt'], '风景, 自然, 美丽')
        self.assertEqual(result['categories'], ['自然', '风景'])
        self.assertEqual(result['tags'], ['美丽', '自然', '户外'])

    def test_parse_analysis_response_plain_text(self):
        """测试解析纯文本格式的分析响应"""
        response_text = '这是一张关于城市夜景的照片，包含高楼大厦和灯光'

        result = self.analyzer._parse_analysis_response(response_text)

        self.assertEqual(result['title'], '')
        self.assertEqual(result['description'], response_text)
        self.assertEqual(result['categories'], [])
        self.assertEqual(result['tags'], [])


class AIAnalysisServiceTest(TransactionTestCase):
    """AI分析服务测试"""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )

        self.service = AIAnalysisService()

    def test_analyze_media_file_not_image(self):
        """测试分析非图片文件"""
        # 创建一个视频文件
        video_file = SimpleUploadedFile(
            'test.mp4',
            b'fake video data',
            content_type='video/mp4'
        )

        media = Media.objects.create(
            user=self.user,
            file=video_file,
            file_type='video',
            file_size=len(video_file)
        )

        with self.assertRaises(ValueError):
            self.service.analyze_media_file(media, self.user)

    @patch('ollama_ai.services.ImageAnalyzer.analyze_image')
    def test_analyze_media_file_success(self, mock_analyze):
        """测试成功分析媒体文件"""
        # 创建一个图片文件
        image_file = SimpleUploadedFile(
            'test.jpg',
            b'fake image data',
            content_type='image/jpeg'
        )

        media = Media.objects.create(
            user=self.user,
            file=image_file,
            file_type='image',
            file_size=len(image_file)
        )

        # 模拟分析结果
        mock_analyze.return_value = {
            'title': '测试标题',
            'description': '测试描述',
            'prompt': '测试提示词',
            'categories': ['分类1', '分类2'],
            'tags': ['标签1', '标签2', '标签3']
        }

        # 模拟文件路径
        with patch.object(media.file, 'path', return_value='/fake/path/test.jpg'):
            ai_analysis = self.service.analyze_media_file(media, self.user)

        self.assertEqual(ai_analysis.status, 'completed')
        self.assertEqual(ai_analysis.ai_title, '测试标题')
        self.assertEqual(ai_analysis.ai_description, '测试描述')
        self.assertEqual(ai_analysis.ai_prompt, '测试提示词')

        # 验证建议的分类和标签被创建
        self.assertEqual(ai_analysis.suggested_categories.count(), 2)
        self.assertEqual(ai_analysis.suggested_tags.count(), 3)


class OllamaAPIViewsTest(APITestCase):
    """Ollama API视图测试"""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )

        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_analyze_image_missing_media_id(self):
        """测试缺少media_id的分析请求"""
        url = '/api/ai/analyze/'
        data = {}

        response = self.client.post(url, data, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)

    def test_analyze_image_invalid_media_type(self):
        """测试分析非图片文件"""
        # 创建一个视频文件
        video_file = SimpleUploadedFile(
            'test.mp4',
            b'fake video data',
            content_type='video/mp4'
        )

        media = Media.objects.create(
            user=self.user,
            file=video_file,
            file_type='video',
            file_size=len(video_file)
        )

        url = '/api/ai/analyze/'
        data = {'media_id': media.id}

        response = self.client.post(url, data, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('只支持分析图片文件', response.data['error'])

    @patch('ollama_ai.views.ai_analysis_service.analyze_media_file')
    def test_analyze_image_success(self, mock_analyze):
        """测试成功分析图片"""
        # 创建一个图片文件
        image_file = SimpleUploadedFile(
            'test.jpg',
            b'fake image data',
            content_type='image/jpeg'
        )

        media = Media.objects.create(
            user=self.user,
            file=image_file,
            file_type='image',
            file_size=len(image_file)
        )

        # 模拟分析结果
        mock_ai_analysis = Mock()
        mock_ai_analysis.id = 1
        mock_ai_analysis.status = 'completed'
        mock_ai_analysis.ai_title = '测试标题'
        mock_ai_analysis.ai_description = '测试描述'
        mock_ai_analysis.ai_prompt = '测试提示词'
        mock_ai_analysis.model_used = 'llava'
        mock_ai_analysis.analysis_result = {'test': 'data'}
        mock_ai_analysis.created_at = '2023-01-01T00:00:00Z'
        mock_ai_analysis.analyzed_at = '2023-01-01T00:01:00Z'

        mock_analyze.return_value = mock_ai_analysis

        url = '/api/ai/analyze/'
        data = {'media_id': media.id}

        response = self.client.post(url, data, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['ai_title'], '测试标题')
        self.assertEqual(response.data['model_used'], 'llava')

    def test_get_analysis_result_not_found(self):
        """测试获取不存在的分析结果"""
        # 创建一个图片文件但没有AI分析
        image_file = SimpleUploadedFile(
            'test.jpg',
            b'fake image data',
            content_type='image/jpeg'
        )

        media = Media.objects.create(
            user=self.user,
            file=image_file,
            file_type='image',
            file_size=len(image_file)
        )

        url = f'/api/ai/analysis/{media.id}/'

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn('尚未进行AI分析', response.data['error'])

    @patch('ollama_ai.services.OllamaClient')
    def test_test_ollama_connection_success(self, mock_client_class):
        """测试Ollama连接成功"""
        mock_client = Mock()
        mock_client.list_models.return_value = [
            {'name': 'llava'},
            {'name': 'llava-v1.5'}
        ]
        mock_client_class.return_value = mock_client

        url = '/api/ai/test-connection/'

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['available_models'], 2)
