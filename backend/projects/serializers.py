from rest_framework import serializers
from .models import Project, ProjectMedia
from media.models import Media
from media.serializers import MediaSerializer


class ProjectMediaSerializer(serializers.ModelSerializer):
    """项目媒体关联序列化器"""
    media_details = serializers.SerializerMethodField()

    class Meta:
        model = ProjectMedia
        fields = [
            'id', 'project', 'media', 'media_details',
            'order', 'notes', 'added_at'
        ]
        read_only_fields = ['id', 'added_at']

    def get_media_details(self, obj):
        """获取媒体文件详细信息"""
        return MediaSerializer(obj.media).data


class ProjectSerializer(serializers.ModelSerializer):
    """项目序列化器"""
    owner_name = serializers.CharField(source='owner.username', read_only=True)
    cover_image_details = serializers.SerializerMethodField()
    media_count = serializers.IntegerField(read_only=True)
    media_list = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id', 'name', 'description',
            'cover_image', 'cover_image_details',
            'owner', 'owner_name',
            'media_count', 'media_list',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'owner', 'created_at', 'updated_at']

    def get_cover_image_details(self, obj):
        """获取封面图片详细信息"""
        if obj.cover_image:
            return MediaSerializer(obj.cover_image).data
        return None

    def get_media_list(self, obj):
        """获取项目中的媒体列表（简要信息）"""
        project_media = obj.project_media.all()[:10]  # 限制返回前10个
        return ProjectMediaSerializer(project_media, many=True).data


class ProjectCreateSerializer(serializers.ModelSerializer):
    """项目创建序列化器"""
    cover_image_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Project
        fields = ['name', 'description', 'cover_image_id']

    def create(self, validated_data):
        cover_image_id = validated_data.pop('cover_image_id', None)
        request = self.context.get('request')

        # 处理封面图片
        cover_image = None
        if cover_image_id:
            try:
                cover_image = Media.objects.get(id=cover_image_id, owner=request.user)
            except Media.DoesNotExist:
                pass

        # owner 由 views.perform_create 通过 serializer.save(owner=...) 传入 validated_data
        # 创建项目
        project = Project.objects.create(**validated_data, cover_image=cover_image)
        return project


class ProjectUpdateSerializer(serializers.ModelSerializer):
    """项目更新序列化器"""
    cover_image_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Project
        fields = ['name', 'description', 'cover_image_id']

    def update(self, instance, validated_data):
        cover_image_id = validated_data.pop('cover_image_id', None)
        request = self.context.get('request')

        # 更新基础字段
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        # 处理封面图片
        if cover_image_id is not None:
            if cover_image_id:
                try:
                    cover_image = Media.objects.get(id=cover_image_id, owner=request.user)
                    instance.cover_image = cover_image
                except Media.DoesNotExist:
                    pass
            else:
                instance.cover_image = None

        instance.save()
        return instance


class AddMediaToProjectSerializer(serializers.Serializer):
    """添加媒体到项目序列化器"""
    media_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=True,
        help_text="媒体文件ID列表"
    )
    notes = serializers.CharField(required=False, allow_blank=True, help_text="备注信息（可选）")

    def validate_media_ids(self, value):
        """验证媒体ID列表"""
        if not value:
            raise serializers.ValidationError("媒体ID列表不能为空")
        return value


class ReorderMediaSerializer(serializers.Serializer):
    """重新排序媒体序列化器"""
    order = serializers.ListField(
        child=serializers.DictField(),
        help_text="排序数据 [{'media_id': 1, 'order': 0}, ...]"
    )
