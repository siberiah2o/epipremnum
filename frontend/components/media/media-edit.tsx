"use client";

import { useState, useEffect } from "react";
import { useMedia, useCategories, useTags } from "@/hooks/use-media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Save, X } from "lucide-react";
import { MediaListItem } from "@/lib/api";
import { FileIcon } from "@/components/ui/file-icon";
import { getFileInfo } from "@/lib/file-utils";

interface MediaEditProps {
  mediaId: number;
  onClose?: () => void;
  onSuccess?: () => void;
}

export function MediaEdit({ mediaId, onClose, onSuccess }: MediaEditProps) {
  const {
    media,
    isLoading,
    error,
    updateMedia,
    addCategories,
    removeCategories,
    addTags,
    removeTags,
  } = useMedia(mediaId);
  const [imageError, setImageError] = useState(false);
  const { categories } = useCategories();
  const { tags } = useTags();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    prompt: "",
  });
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 当媒体数据加载完成后初始化表单
  useEffect(() => {
    if (media) {
      setFormData({
        title: media.title,
        description: media.description,
        prompt: media.prompt,
      });
      setSelectedCategories(media.categories.map((cat) => cat.id));
      setSelectedTags(media.tags.map((tag) => tag.id));
      setImageError(false); // 重置图片错误状态
    }
  }, [media]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!media) return;

    setIsSubmitting(true);

    try {
      // 更新基本信息
      const updateResult = await updateMedia({
        title: formData.title.trim(),
        description: formData.description.trim(),
        prompt: formData.prompt.trim(),
        category_ids: selectedCategories,
        tag_ids: selectedTags,
      });

      if (!updateResult.success) {
        toast.error(updateResult.message || "更新失败");
        return;
      }

      // 处理分类变更
      const currentCategoryIds = media.categories.map((cat) => cat.id);
      const categoriesToAdd = selectedCategories.filter(
        (id) => !currentCategoryIds.includes(id)
      );
      const categoriesToRemove = currentCategoryIds.filter(
        (id) => !selectedCategories.includes(id)
      );

      if (categoriesToAdd.length > 0) {
        await addCategories({ category_ids: categoriesToAdd });
      }

      if (categoriesToRemove.length > 0) {
        await removeCategories({ category_ids: categoriesToRemove });
      }

      // 处理标签变更
      const currentTagIds = media.tags.map((tag) => tag.id);
      const tagsToAdd = selectedTags.filter(
        (id) => !currentTagIds.includes(id)
      );
      const tagsToRemove = currentTagIds.filter(
        (id) => !selectedTags.includes(id)
      );

      if (tagsToAdd.length > 0) {
        await addTags({ tag_ids: tagsToAdd });
      }

      if (tagsToRemove.length > 0) {
        await removeTags({ tag_ids: tagsToRemove });
      }

      toast.success("媒体文件更新成功");
      onSuccess?.();
      onClose?.();
    } catch (error) {
      toast.error("更新失败，请重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCategoryToggle = (categoryId: number) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleTagToggle = (tagId: number) => {
    setSelectedTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  const getFileIcon = (fileType: string) => {
    return <FileIcon mimeType={fileType} size="sm" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!media) {
    return (
      <Alert>
        <AlertDescription>未找到媒体文件</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 文件信息 */}
          <div className="space-y-2">
            <Label>文件信息</Label>
            <div className="flex items-center gap-4 p-4 border rounded-lg">
              {/* 左侧：图片缩略图 */}
              {media.file_type === "image" ? (
                imageError ? (
                  <div className="h-16 w-16 rounded bg-muted flex items-center justify-center">
                    {getFileIcon(media.file_type)}
                  </div>
                ) : (
                  <div className="h-16 w-16 rounded overflow-hidden">
                    <img
                      src={media.file_url}
                      alt={media.title}
                      className="h-16 w-16 object-cover"
                      onError={() => setImageError(true)}
                    />
                  </div>
                )
              ) : media.thumbnail_url ? (
                <div className="h-16 w-16 rounded overflow-hidden">
                  <img
                    src={media.thumbnail_url}
                    alt={media.title}
                    className="h-16 w-16 object-cover"
                  />
                </div>
              ) : (
                <div className="h-16 w-16 rounded bg-muted flex items-center justify-center">
                  {getFileIcon(media.file_type)}
                </div>
              )}

              {/* 中间：文件信息 */}
              <div className="flex-1">
                <p className="font-medium">{media.title}</p>
                <p className="text-sm text-muted-foreground">
                  {getFileInfo(media.file_type).displayName} •{" "}
                  {formatFileSize(media.file_size)}
                </p>
                <p className="text-xs text-muted-foreground">
                  创建于 {new Date(media.created_at).toLocaleString()}
                </p>
              </div>

              {/* 右侧：操作按钮 */}
              <div className="flex gap-2">
                {onClose && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    disabled={isSubmitting}
                  >
                    取消
                  </Button>
                )}
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      保存中...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      保存更改
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          {/* 基本信息 */}
          <div className="space-y-4">
            {/* 标题 */}
            <div className="space-y-2">
              <Label htmlFor="title">标题</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    title: e.target.value,
                  }))
                }
                placeholder="输入媒体文件标题"
                disabled={isSubmitting}
                required
              />
            </div>

            {/* 描述和提示词左右布局 */}
            <div className="grid grid-cols-2 gap-6">
              {/* 描述 */}
              <div className="space-y-2">
                <Label htmlFor="description">描述</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="输入媒体文件描述"
                  disabled={isSubmitting}
                  rows={5}
                />
              </div>

              {/* 生成提示词 */}
              <div className="space-y-2">
                <Label htmlFor="prompt">生成提示词</Label>
                <Textarea
                  id="prompt"
                  value={formData.prompt}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      prompt: e.target.value,
                    }))
                  }
                  placeholder="输入用于生成的提示词或关键词"
                  disabled={isSubmitting}
                  rows={5}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* 分类和标签选择 */}
          <div className="grid grid-cols-2 gap-6">
            {/* 分类选择 */}
            <div className="space-y-2">
              <Label>分类</Label>
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <Badge
                    key={category.id}
                    variant={
                      selectedCategories.includes(category.id)
                        ? "default"
                        : "outline"
                    }
                    className="cursor-pointer"
                    onClick={() => handleCategoryToggle(category.id)}
                  >
                    {category.name}
                  </Badge>
                ))}
              </div>
              {categories.length === 0 && (
                <p className="text-sm text-muted-foreground">暂无可用分类</p>
              )}
            </div>

            {/* 标签选择 */}
            <div className="space-y-2">
              <Label>标签</Label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant={
                      selectedTags.includes(tag.id) ? "default" : "outline"
                    }
                    className="cursor-pointer"
                    onClick={() => handleTagToggle(tag.id)}
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
              {tags.length === 0 && (
                <p className="text-sm text-muted-foreground">暂无可用标签</p>
              )}
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
