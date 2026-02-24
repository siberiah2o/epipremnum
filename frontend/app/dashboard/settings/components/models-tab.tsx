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
import { Loader2, Plus, Trash2, Star } from 'lucide-react';
import { toast } from 'sonner';

const llmModelSchema = z.object({
  endpoint: z.number().refine((val) => val !== 0, { message: '请选择端点' }),
  name: z.string().min(1, '请输入模型名称'),
});

type LLMModelFormValues = z.infer<typeof llmModelSchema>;

interface Endpoint {
  id: number;
  name: string;
  provider_type: LLMProviderType;
  is_default: boolean;
}

interface AIModel {
  id: number;
  name: string;
  endpoint: number;
  endpoint_name?: string;
  is_default: boolean;
}

const PROVIDER_CONFIGS: Record<LLMProviderType, { label: string; badgeColor: string }> = {
  ollama: { label: 'Ollama', badgeColor: 'bg-green-100 text-green-800' },
  openai: { label: 'OpenAI', badgeColor: 'bg-blue-100 text-blue-800' },
  zhipu: { label: '智谱', badgeColor: 'bg-purple-100 text-purple-800' },
};

export function ModelsTab() {
  const [isLoading, setIsLoading] = useState(false);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [models, setModels] = useState<AIModel[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);

  const llmModelForm = useForm<LLMModelFormValues>({
    resolver: zodResolver(llmModelSchema),
    defaultValues: { endpoint: 0, name: '' },
    mode: 'onChange',
  });

  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingData(true);
      try {
        const [endpointRes, modelRes] = await Promise.all([llmApi.getEndpoints(), llmApi.getModels()]);
        if (Array.isArray(endpointRes)) setEndpoints(endpointRes);
        else if (endpointRes.code === 200 && Array.isArray(endpointRes.data)) setEndpoints(endpointRes.data);
        if (Array.isArray(modelRes)) setModels(modelRes);
        else if (modelRes.code === 200 && Array.isArray(modelRes.data)) setModels(modelRes.data);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      }
      setIsLoadingData(false);
    };
    fetchData();
  }, []);

  const fetchModels = async () => {
    try {
      const response = await llmApi.getModels();
      if (Array.isArray(response)) setModels(response);
      else if (response.code === 200 && Array.isArray(response.data)) setModels(response.data);
    } catch (error) {
      console.error('Failed to fetch models:', error);
    }
  };

  const onSubmit = async (data: LLMModelFormValues) => {
    setIsLoading(true);
    try {
      const response = await llmApi.createModel(data);
      if (response.code === 200 || response.code === 201 || response.data?.id) {
        toast.success('模型添加成功');
        llmModelForm.reset();
        fetchModels();
      } else {
        toast.error(response.message || '添加失败');
      }
    } catch (error) {
      toast.error('网络请求失败');
    }
    setIsLoading(false);
  };

  const handleDeleteModel = async (id: number) => {
    setItemToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (itemToDelete === null) return;
    setIsLoading(true);
    setDeleteDialogOpen(false);
    try {
      const response = await llmApi.deleteModel(itemToDelete);
      if (response.code === 200) {
        toast.success('模型删除成功');
        fetchModels();
      } else {
        toast.error(response.message || '删除失败');
      }
    } catch (error) {
      toast.error('网络请求失败');
    }
    setIsLoading(false);
    setItemToDelete(null);
  };

  const handleSetDefault = async (id: number) => {
    setIsLoading(true);
    try {
      const response = await llmApi.setDefaultModel(id);
      if (response.code === 200 || response.data?.is_default !== undefined) {
        fetchModels();
      } else {
        toast.error(response.message || '操作失败');
      }
    } catch (error) {
      toast.error('网络请求失败');
    }
    setIsLoading(false);
  };

  // 按端点分组模型
  const modelsByEndpoint = models.reduce((acc, model) => {
    const key = model.endpoint;
    if (!acc[key]) acc[key] = [];
    acc[key].push(model);
    return acc;
  }, {} as Record<number, AIModel[]>);

  return (
    <>
      <div className="grid lg:grid-cols-2 gap-4 h-full">
        {/* 左侧：手动添加表单 */}
        <Card className="p-4 flex flex-col">
          <div className="font-medium mb-4 shrink-0">手动添加模型</div>
          <div className="mb-4 p-3 bg-muted/30 rounded-lg text-sm text-muted-foreground">
            <p>Ollama 端点请在「API 端点」标签页使用「同步模型」功能自动添加</p>
          </div>
          <Form {...llmModelForm}>
            <form onSubmit={llmModelForm.handleSubmit(onSubmit)} className="flex-1 flex flex-col">
              <div className="space-y-4 flex-1">
                <FormField
                  control={llmModelForm.control}
                  name="endpoint"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>所属端点</FormLabel>
                      <FormControl>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={isLoading}
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        >
                          <option value={0}>选择端点</option>
                          {endpoints.map((endpoint) => (
                            <option key={endpoint.id} value={endpoint.id}>
                              {endpoint.name}
                              {endpoint.is_default ? ' (默认)' : ''}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={llmModelForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>模型名称</FormLabel>
                      <FormControl>
                        <Input placeholder="如 gpt-4、llama3 等" className="h-10" disabled={isLoading} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" disabled={isLoading} className="w-full mt-4">
                {isLoading ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />添加中...</> : <><Plus className="mr-1.5 h-4 w-4" />添加模型</>}
              </Button>
            </form>
          </Form>
        </Card>

        {/* 右侧：已配置模型列表（按端点分组） */}
        <Card className="p-4 flex flex-col">
          <div className="font-medium mb-3 shrink-0">已配置模型 ({models.length})</div>
          <div className="flex-1 overflow-y-auto pr-1 min-h-0">
            {isLoadingData ? (
              <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : models.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <p>{endpoints.length === 0 ? '请先添加端点' : '暂无模型'}</p>
                <p className="text-sm mt-1">{endpoints.length === 0 ? '在「API 端点」标签添加' : '使用同步功能或手动添加模型'}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(modelsByEndpoint).map(([endpointId, endpointModels]) => {
                  const endpoint = endpoints.find(e => e.id === Number(endpointId));
                  const providerConfig = endpoint ? PROVIDER_CONFIGS[endpoint.provider_type] : null;

                  return (
                    <div key={endpointId} className="space-y-2">
                      {/* 端点标题 */}
                      <div className="flex items-center gap-2 px-1">
                        <span className="font-medium text-sm">{endpoint?.name || '未知端点'}</span>
                        {endpoint?.is_default && (
                          <span className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">默认端点</span>
                        )}
                        {providerConfig && (
                          <Badge className={providerConfig.badgeColor} variant="secondary">{providerConfig.label}</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">({endpointModels.length})</span>
                      </div>

                      {/* 该端点的模型列表 */}
                      <div className="space-y-1">
                        {endpointModels.map((model) => (
                          <div
                            key={model.id}
                            className={`group flex items-center justify-between gap-3 px-3 py-2 border rounded-lg cursor-pointer transition-all ${
                              model.is_default ? 'border-primary/50 bg-primary/5' : 'hover:border-primary/50 hover:bg-muted/30'
                            }`}
                            onClick={() => handleSetDefault(model.id)}
                          >
                            <div className="flex-1 min-w-0 flex items-center gap-2">
                              {model.is_default && <Star className="h-4 w-4 text-primary fill-primary shrink-0" />}
                              <span className="font-medium truncate text-sm">{model.name}</span>
                              {model.is_default && <span className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">默认</span>}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Star className={`h-4 w-4 ${model.is_default ? 'fill-primary text-primary' : 'text-muted-foreground'} group-hover:text-primary transition-colors`} />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => { e.stopPropagation(); handleDeleteModel(model.id); }}
                                disabled={isLoading}
                                className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
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
            <AlertDialogDescription>确定要删除此模型吗？此操作无法撤销。</AlertDialogDescription>
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
