'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { llmApi } from '@/lib/api-client';
import type { LLMProviderType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, Edit, X, RefreshCw, Star, Download } from 'lucide-react';
import { toast } from 'sonner';

const llmEndpointSchema = z.object({
  name: z.string().min(1, '请输入端点名称'),
  provider_type: z.enum(['ollama', 'openai', 'zhipu']),
  base_url: z.string().min(1, '请输入API地址'),
  api_key: z.string().optional(),
});

type LLMEndpointFormValues = z.infer<typeof llmEndpointSchema>;

interface Endpoint {
  id: number;
  name: string;
  provider_type: LLMProviderType;
  base_url: string;
  api_key: string;
  is_default: boolean;
  model_count?: number;
}

const PROVIDER_CONFIGS: Record<LLMProviderType, { label: string; description: string; defaultUrl: string; urlPlaceholder: string; keyLabel: string; keyPlaceholder: string; badgeColor: string }> = {
  ollama: {
    label: 'Ollama',
    description: '本地 Ollama 服务',
    defaultUrl: 'http://localhost:11434',
    urlPlaceholder: 'http://localhost:11434',
    keyLabel: '密钥(可选)',
    keyPlaceholder: '通常不需要',
    badgeColor: 'bg-green-100 text-green-800',
  },
  openai: {
    label: 'OpenAI',
    description: 'OpenAI 兼容 API',
    defaultUrl: 'https://api.openai.com/v1',
    urlPlaceholder: 'https://api.openai.com/v1',
    keyLabel: 'API 密钥',
    keyPlaceholder: 'sk-...',
    badgeColor: 'bg-blue-100 text-blue-800',
  },
  zhipu: {
    label: '智谱',
    description: '智谱 AI GLM',
    defaultUrl: 'https://open.bigmodel.cn/api/paas/v4',
    urlPlaceholder: 'https://open.bigmodel.cn/api/paas/v4',
    keyLabel: 'API 密钥',
    keyPlaceholder: '智谱 API Key',
    badgeColor: 'bg-purple-100 text-purple-800',
  },
};

export function EndpointsTab() {
  const [isLoading, setIsLoading] = useState(false);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [isLoadingEndpoints, setIsLoadingEndpoints] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const [editingEndpoint, setEditingEndpoint] = useState<Endpoint | null>(null);
  const [syncingEndpointId, setSyncingEndpointId] = useState<number | null>(null);

  const llmEndpointForm = useForm<LLMEndpointFormValues>({
    resolver: zodResolver(llmEndpointSchema),
    defaultValues: { name: '', provider_type: 'openai', base_url: '', api_key: '' },
    mode: 'onChange',
  });

  const providerType = llmEndpointForm.watch('provider_type');

  useEffect(() => { fetchEndpoints(); }, []);

  const fetchEndpoints = async () => {
    setIsLoadingEndpoints(true);
    try {
      const response = await llmApi.getEndpoints();
      if (Array.isArray(response)) setEndpoints(response);
      else if (response.code === 200 && Array.isArray(response.data)) setEndpoints(response.data);
    } catch (error) {
      console.error('Failed to fetch endpoints:', error);
    }
    setIsLoadingEndpoints(false);
  };

  const resetForm = () => {
    llmEndpointForm.reset({ name: '', provider_type: 'openai', base_url: '', api_key: '' });
    setEditingEndpoint(null);
  };

  const onSubmit = async (data: LLMEndpointFormValues) => {
    setIsLoading(true);
    try {
      if (editingEndpoint) {
        const response = await llmApi.updateEndpoint(editingEndpoint.id, { ...data, api_key: data.api_key || '' });
        if (response.code === 200) {
          toast.success('端点更新成功');
          resetForm();
          fetchEndpoints();
        } else {
          toast.error(response.message || '更新失败');
        }
      } else {
        const response = await llmApi.createEndpoint({ ...data, api_key: data.api_key || '' });
        if (response.code === 200 || response.code === 201 || response.data?.id) {
          toast.success('端点创建成功');
          resetForm();
          fetchEndpoints();
        } else {
          toast.error(response.message || '创建失败');
        }
      }
    } catch (error) {
      toast.error('网络请求失败');
    }
    setIsLoading(false);
  };

  const handleEditEndpoint = (endpoint: Endpoint) => {
    setEditingEndpoint(endpoint);
    llmEndpointForm.reset({ name: endpoint.name, provider_type: endpoint.provider_type, base_url: endpoint.base_url, api_key: endpoint.api_key });
  };

  const handleDeleteEndpoint = async (id: number) => {
    setItemToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (itemToDelete === null) return;
    setIsLoading(true);
    setDeleteDialogOpen(false);
    try {
      const response = await llmApi.deleteEndpoint(itemToDelete);
      if (response.code === 200) {
        toast.success('端点删除成功');
        if (editingEndpoint?.id === itemToDelete) resetForm();
        fetchEndpoints();
      } else {
        toast.error(response.message || '删除失败');
      }
    } catch (error) {
      toast.error('网络请求失败');
    }
    setIsLoading(false);
    setItemToDelete(null);
  };

  // 同步模型（仅Ollama）
  const handleSyncModels = async (endpoint: Endpoint) => {
    if (endpoint.provider_type !== 'ollama') {
      toast.error('只有 Ollama 端点支持自动同步模型');
      return;
    }

    setSyncingEndpointId(endpoint.id);
    try {
      const response = await llmApi.syncEndpointModels(endpoint.id);
      if (response.code === 200 && response.data) {
        const { synced, total, message } = response.data;
        if (synced > 0) {
          toast.success(message || `成功同步 ${synced} 个新模型`);
        } else {
          toast.info(message || '所有模型已同步，无新模型');
        }
        fetchEndpoints();
      } else {
        toast.error(response.message || '同步失败');
      }
    } catch (error) {
      toast.error('同步失败，请检查网络连接');
    }
    setSyncingEndpointId(null);
  };

  // 设置默认端点
  const handleSetDefault = async (endpoint: Endpoint) => {
    setIsLoading(true);
    try {
      const response = await llmApi.setDefaultEndpoint(endpoint.id);
      if (response.code === 200) {
        toast.success(response.data?.message || `已将 ${endpoint.name} 设为默认端点`);
        fetchEndpoints();
      } else {
        toast.error(response.message || '操作失败');
      }
    } catch (error) {
      toast.error('网络请求失败');
    }
    setIsLoading(false);
  };

  const currentConfig = providerType ? PROVIDER_CONFIGS[providerType] : PROVIDER_CONFIGS.openai;
  const isEditMode = editingEndpoint !== null;

  return (
    <>
      <div className="grid lg:grid-cols-2 gap-4 h-full">
        {/* 左侧：表单 */}
        <Card className="p-4 flex flex-col">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <span className="font-medium">{isEditMode ? '编辑端点' : '添加端点'}</span>
            {isEditMode && (
              <Button variant="ghost" size="sm" onClick={resetForm} disabled={isLoading} className="h-7 px-2 text-xs">
                <X className="h-3 w-3 mr-1" />取消
              </Button>
            )}
          </div>
          <Form {...llmEndpointForm}>
            <form onSubmit={llmEndpointForm.handleSubmit(onSubmit)} className="flex-1 flex flex-col">
              <div className="space-y-4 flex-1">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={llmEndpointForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>名称</FormLabel>
                        <FormControl>
                          <Input placeholder="名称" className="h-10" disabled={isLoading} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={llmEndpointForm.control}
                    name="provider_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>提供商</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={isLoading}>
                          <FormControl>
                            <SelectTrigger className="h-10"><SelectValue placeholder="选择" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(PROVIDER_CONFIGS).map(([key, config]) => (
                              <SelectItem key={key} value={key}>{config.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={llmEndpointForm.control}
                  name="base_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>API 地址</FormLabel>
                      <FormControl>
                        <Input placeholder={currentConfig.urlPlaceholder} className="h-10" disabled={isLoading} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={llmEndpointForm.control}
                  name="api_key"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{currentConfig.keyLabel}</FormLabel>
                      <FormControl>
                        <Input placeholder={currentConfig.keyPlaceholder} type="password" className="h-10" disabled={isLoading} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" disabled={isLoading} className="w-full mt-4">
                {isLoading ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />{isEditMode ? '保存中...' : '添加中...'}</> : <>{isEditMode ? '保存' : <><Plus className="mr-1.5 h-4 w-4" />添加端点</>}</>}
              </Button>
            </form>
          </Form>
        </Card>

        {/* 右侧：列表 */}
        <Card className="p-4 flex flex-col">
          <div className="font-medium mb-3 shrink-0">已配置端点 ({endpoints.length})</div>
          <div className="flex-1 overflow-y-auto pr-1 min-h-0">
            {isLoadingEndpoints ? (
              <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : endpoints.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <p>暂无端点</p>
                <p className="text-sm mt-1">在左侧添加您的第一个端点</p>
              </div>
            ) : (
              <div className="space-y-2">
                {endpoints.map((endpoint) => {
                  const config = PROVIDER_CONFIGS[endpoint.provider_type] || PROVIDER_CONFIGS.openai;
                  const isEditing = editingEndpoint?.id === endpoint.id;
                  const isSyncing = syncingEndpointId === endpoint.id;
                  const isOllama = endpoint.provider_type === 'ollama';

                  return (
                    <div
                      key={endpoint.id}
                      className={`group flex flex-col gap-2 px-3 py-2.5 border rounded-lg transition-all ${
                        isEditing ? 'border-primary bg-primary/5' : 'hover:border-primary/50 hover:bg-muted/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => handleEditEndpoint(endpoint)}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {endpoint.is_default && <Star className="h-4 w-4 text-primary fill-primary shrink-0" />}
                            {isEditing && <Edit className="h-4 w-4 text-primary" />}
                            <span className="font-medium truncate">{endpoint.name}</span>
                            <Badge className={config.badgeColor} variant="secondary">{config.label}</Badge>
                            {endpoint.is_default && (
                              <span className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">默认</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="truncate">{endpoint.base_url}</span>
                            {endpoint.model_count !== undefined && (
                              <Badge variant="outline" className="text-xs">{endpoint.model_count} 模型</Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 操作按钮 */}
                      <div className="flex items-center gap-2 justify-end">
                        {/* Ollama 同步按钮 */}
                        {isOllama && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSyncModels(endpoint)}
                            disabled={isSyncing || isLoading}
                            className="h-7 px-2 text-xs"
                          >
                            {isSyncing ? (
                              <><Loader2 className="h-3 w-3 mr-1 animate-spin" />同步中...</>
                            ) : (
                              <><Download className="h-3 w-3 mr-1" />同步模型</>
                            )}
                          </Button>
                        )}

                        {/* 设置默认 */}
                        {!endpoint.is_default && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetDefault(endpoint)}
                            disabled={isLoading}
                            className="h-7 px-2 text-xs"
                          >
                            <Star className="h-3 w-3 mr-1" />设为默认
                          </Button>
                        )}

                        {/* 删除 */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteEndpoint(endpoint.id)}
                          disabled={isLoading}
                          className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>确定要删除此端点吗？该端点下的所有模型也会被删除。此操作无法撤销。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
