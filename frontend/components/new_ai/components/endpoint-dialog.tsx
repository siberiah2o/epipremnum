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
import { OllamaEndpoint, CreateEndpointRequest } from "../types/ai";

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
      description: "",
      is_default: false,
      timeout: 300,
    });
  };

  // 当端点数据变化时，更新表单
  useEffect(() => {
    if (endpoint) {
      setForm({
        name: endpoint.name || "",
        url: endpoint.url || "",
        description: endpoint.description || "",
        is_default: endpoint.is_default ?? false,
        timeout: endpoint.timeout ?? 300,
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
          <DialogDescription>配置 Ollama AI 服务的连接端点</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">端点名称</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="例如：本地Ollama、远程服务器"
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
              placeholder="http://localhost:11434"
              required
            />
          </div>
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
            disabled={isSubmitting || !form.name.trim() || !form.url.trim()}
          >
            {isSubmitting ? "提交中..." : (endpoint ? "更新" : "创建")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}