'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { mediaApi } from '@/lib/api-client';
import { toast } from 'sonner';
import { Upload, X, Loader2, Image as ImageIcon, Check } from 'lucide-react';

export default function MediaUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });

  // 处理文件选择
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const imageFiles = selectedFiles.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      toast.error('请选择图片文件');
      return;
    }

    setFiles(prev => [...prev, ...imageFiles]);
    setUploadProgress(prev => ({ ...prev, total: files.length + imageFiles.length }));

    // 生成预览
    imageFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });

    // 清空 input 允许重复选择
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [files.length]);

  // 移除文件
  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  // 上传文件
  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error('请选择要上传的图片');
      return;
    }

    setUploading(true);
    setUploadProgress({ current: 0, total: files.length, success: 0, failed: 0 });

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(prev => ({ ...prev, current: i + 1 }));

      try {
        await mediaApi.uploadMedia(file, null, []);
        setUploadProgress(prev => ({ ...prev, success: prev.success + 1 }));
      } catch (error) {
        setUploadProgress(prev => ({ ...prev, failed: prev.failed + 1 }));
        console.error('Upload failed:', error);
      }
    }

    setUploading(false);

    const { success, failed, total } = uploadProgress;
    if (success === total) {
      toast.success(`成功上传 ${success} 张图片`);
      setFiles([]);
      setPreviews([]);
      setUploadProgress({ current: 0, total: 0, success: 0, failed: 0 });
      setTimeout(() => router.push('/dashboard/media'), 500);
    } else if (success > 0) {
      toast.success(`成功上传 ${success} 张，${failed} 张失败`);
    } else {
      toast.error('上传失败');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">上传图片</h1>
        <p className="text-muted-foreground">标签和分类将由 AI 自动分析</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>选择文件</CardTitle>
          <CardDescription>支持 JPG、PNG、GIF、WebP 等图片格式</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 上传区域 */}
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center hover:border-primary/50 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              id="file-upload"
              multiple
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              disabled={uploading}
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <Upload className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-base text-muted-foreground mb-2">
                点击选择或拖拽图片到此处
              </p>
              <p className="text-sm text-muted-foreground">
                支持多张图片同时上传
              </p>
            </label>
          </div>

          {/* 预览区域 */}
          {previews.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  已选择 {files.length} 张图片
                </p>
                {!uploading && files.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFiles([]);
                      setPreviews([]);
                      setUploadProgress({ current: 0, total: 0, success: 0, failed: 0 });
                    }}
                  >
                    清空全部
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                {previews.map((preview, index) => (
                  <div key={index} className="relative group aspect-square rounded-lg overflow-hidden border">
                    <img
                      src={preview}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => removeFile(index)}
                      className="absolute top-2 right-2 p-1 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      disabled={uploading}
                    >
                      <X className="h-4 w-4 text-white" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/50 text-white text-xs truncate">
                      {files[index]?.name}
                    </div>
                    {/* 上传状态 */}
                    {uploading && (
                      <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                        {index < uploadProgress.current ? (
                          <Check className="h-8 w-8 text-green-500" />
                        ) : (
                          <Loader2 className="h-8 w-8 text-white animate-spin" />
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* 上传进度 */}
              {uploading && (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-2">
                    上传中... {uploadProgress.current} / {uploadProgress.total}
                  </p>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-primary h-full transition-all duration-300"
                      style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* 上传按钮 */}
              <Button
                onClick={handleUpload}
                disabled={files.length === 0 || uploading}
                className="w-full"
                size="lg"
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    上传中 ({uploadProgress.current}/{uploadProgress.total})
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-5 w-5" />
                    上传 {files.length} 张图片
                  </>
                )}
              </Button>
            </div>
          )}

          {previews.length === 0 && !uploading && (
            <div className="text-center py-12 text-muted-foreground">
              <ImageIcon className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p>还没有选择图片</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
