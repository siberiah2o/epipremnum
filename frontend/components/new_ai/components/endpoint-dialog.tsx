import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Info, Lock, LockOpen } from "lucide-react";
import {
  OllamaEndpoint,
  CreateEndpointRequest,
  AIProvider,
  AI_PROVIDERS
} from "../types/ai";

interface EndpointDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  endpoint?: OllamaEndpoint | null;
  onSubmit: (data: CreateEndpointRequest) => Promise<boolean>;
}

export function EndpointDialog({
  open,
  onOpenChange,
  endpoint,
  onSubmit,
}: EndpointDialogProps) {
  const [form, setForm] = useState<CreateEndpointRequest>({
    name: "",
    url: "",
    provider: "ollama",
    api_key: "",
    auth_type: "none",
    description: "",
    is_default: false,
    timeout: 300,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 重置表单
  const resetForm = () => {
    setForm({
      name: "",
      url: "",
      provider: "ollama",
      api_key: "",
      auth_type: "none",
      description: "",
      is_default: false,
      timeout: 300,
    });
  };

  // 处理供应商变化
  const handleProviderChange = (provider: AIProvider) => {
    const providerConfig = AI_PROVIDERS[provider];
    setForm(prev => ({
      ...prev,
      provider,
      auth_type: providerConfig.defaultAuthType,
      // 如果不需要API Key，清空它
      api_key: providerConfig.requiresApiKey ? prev.api_key : "",
    }));
  };

  // 当端点数据变化时，更新表单
  useEffect(() => {
    if (endpoint) {
      setForm({
        name: endpoint.name || "",
        url: endpoint.url || "",
        provider: endpoint.provider || "ollama",
        api_key: "", // 不回填API Key，安全考虑
        auth_type: endpoint.auth_type || "none",
        description: endpoint.description || "",
        is_default: endpoint.is_default ?? false,
        timeout: 300, // 默认值
      });
    } else {
      resetForm();
    }
  }, [endpoint]);

  // 处理提交
  const handleSubmit = async () => {
    // 表单验证
    if (!form.name.trim()) {
      return;
    }
    if (!form.url.trim()) {
      return;
    }

    // 根据供应商验证必填字段
    // 编辑时，如果已经设置了API Key，就不要求重新输入
    const providerConfig = AI_PROVIDERS[form.provider || "ollama"];
    if (providerConfig.requiresApiKey && !endpoint && !form.api_key?.trim()) {
      // 只有在创建新端点时才要求API Key
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await onSubmit(form);
      if (success) {
        onOpenChange(false);
        resetForm();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // 处理取消
  const handleCancel = () => {
    onOpenChange(false);
    resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {endpoint ? "编辑端点" : "创建新端点"}
          </DialogTitle>
          <DialogDescription>配置 AI 服务的连接端点</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="provider">供应商类型</Label>
            <Select
              value={form.provider || "ollama"}
              onValueChange={(value: AIProvider) => handleProviderChange(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择供应商" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(AI_PROVIDERS).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          
          <div className="space-y-2">
            <Label htmlFor="name">端点名称</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="例如：本地Ollama、智谱AI"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="url">服务地址</Label>
            <Input
              id="url"
              value={form.url}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, url: e.target.value }))
              }
              placeholder={
                form.provider === "ollama"
                  ? "http://localhost:11434"
                  : "https://api.example.com/v1"
              }
              required
            />
          </div>

          {/* API Key 字段 - 只在需要时显示 */}
          {form.provider && AI_PROVIDERS[form.provider].requiresApiKey && (
            <div className="space-y-2">
              <Label htmlFor="api_key">API Key</Label>
              <Input
                id="api_key"
                type="password"
                value={form.api_key || ""}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, api_key: e.target.value }))
                }
                placeholder="输入您的 API Key"
                required
              />
              <p className="text-xs text-muted-foreground">
                API Key 将被安全存储，不会在响应中返回
              </p>
            </div>
          )}

          {/* 认证类型选择 */}
          {form.provider && form.provider !== "ollama" && (
            <div className="space-y-2">
              <Label htmlFor="auth_type">认证类型</Label>
              <Select
                value={form.auth_type || "api_key"}
                onValueChange={(value) => setForm(prev => ({ ...prev, auth_type: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="api_key">API Key</SelectItem>
                  <SelectItem value="bearer_token">Bearer Token</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="description">描述</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="可选的端点描述"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timeout">超时时间（秒）</Label>
            <Input
              id="timeout"
              type="number"
              value={form.timeout}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  timeout: parseInt(e.target.value) || 300,
                }))
              }
              min="1"
              max="300"
            />
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="is_default"
              checked={form.is_default}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  is_default: e.target.checked,
                }))
              }
            />
            <Label htmlFor="is_default">设为默认端点</Label>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            type="button"
            disabled={
              isSubmitting ||
              !form.name.trim() ||
              !form.url.trim() ||
              // 只有在创建新端点且供应商需要API Key时才检查
              (!endpoint && AI_PROVIDERS[form.provider || "ollama"].requiresApiKey && !form.api_key?.trim())
            }
          >
            {isSubmitting ? "提交中..." : (endpoint ? "更新" : "创建")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}