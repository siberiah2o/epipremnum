"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Brain,
  Eye,
  HardDrive,
  Activity,
  Settings,
  Zap,
  Plus,
  Edit,
  Trash2,
  Server,
} from "lucide-react";
import {
  aiManagementService,
  connectionStatusManager,
  type OllamaModel,
  type OllamaEndpoint,
  type CreateEndpointRequest,
} from "@/lib/ai-service";
import { toast } from "sonner";

export function AIManagement() {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [endpoints, setEndpoints] = useState<OllamaEndpoint[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "checking" | "connected" | "failed"
  >("idle");
  const [isSyncing, setIsSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 端点管理状态
  const [showEndpointDialog, setShowEndpointDialog] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState<OllamaEndpoint | null>(
    null
  );
  const [endpointForm, setEndpointForm] = useState<CreateEndpointRequest>({
    name: "",
    url: "",
    description: "",
    is_default: false,
    timeout: 300,
  });

  // 获取模型列表
  const fetchModels = async () => {
    try {
      const result = await aiManagementService.getAvailableModels();
      console.log("获取模型响应:", result);
      if (result && result.models) {
        setModels(result.models);
      } else if (result && Array.isArray(result)) {
        // 如果直接返回数组
        setModels(result);
      } else {
        console.error("模型数据格式不正确:", result);
        setModels([]);
      }
    } catch (err) {
      console.error("获取模型失败:", err);
      setError("无法获取模型列表");
      setModels([]);
    }
  };

  // 获取端点列表
  const fetchEndpoints = async () => {
    try {
      const result = await aiManagementService.getEndpoints();
      console.log("获取端点响应:", result);
      if (result && result.endpoints) {
        setEndpoints(result.endpoints);
      } else if (result && Array.isArray(result)) {
        // 如果直接返回数组
        setEndpoints(result);
      } else {
        console.error("端点数据格式不正确:", result);
        setEndpoints([]);
      }
    } catch (err) {
      console.error("获取端点失败:", err);
      setEndpoints([]);
    }
  };

  // 测试连接
  const testConnection = async () => {
    setConnectionStatus("checking");
    try {
      const result = await aiManagementService.testConnection();
      if (result.status === "success") {
        setConnectionStatus("connected");
        // 使用连接状态管理器防止重复提醒
        if (connectionStatusManager.shouldShowSuccessMessage()) {
          toast.success("Ollama服务连接成功");
        }
      } else {
        setConnectionStatus("failed");
        toast.error("Ollama服务连接失败");
      }
    } catch (err) {
      setConnectionStatus("failed");
      toast.error("连接测试失败");
    }
  };

  // 同步模型
  const syncModels = async () => {
    setIsSyncing(true);
    setError(null);

    try {
      const result = await aiManagementService.syncModels();
      await fetchModels(); // 重新获取模型列表
      toast.success(
        `模型同步完成: ${result.synced} 个新模型, ${result.updated} 个更新`
      );
    } catch (err: any) {
      console.error("同步模型失败:", err);
      setError(err.message || "同步模型失败");
      toast.error(err.message || "同步模型失败");
    } finally {
      setIsSyncing(false);
    }
  };

  // 端点管理函数
  const handleCreateEndpoint = async () => {
    // 表单验证
    if (!endpointForm.name.trim()) {
      toast.error("请输入端点名称");
      return;
    }
    if (!endpointForm.url.trim()) {
      toast.error("请输入服务地址");
      return;
    }

    try {
      const result = await aiManagementService.createEndpoint(endpointForm);
      toast.success("端点创建成功");
      setShowEndpointDialog(false);
      setEndpointForm({
        name: "",
        url: "",
        description: "",
        is_default: false,
        timeout: 300,
      });

      // 立即刷新端点列表
      await fetchEndpoints();
    } catch (err: any) {
      console.error("创建端点失败:", err);
      toast.error(err.message || "创建端点失败");
    }
  };

  const handleUpdateEndpoint = async () => {
    if (!editingEndpoint) return;

    try {
      const result = await aiManagementService.updateEndpoint(
        editingEndpoint.id,
        endpointForm
      );
      toast.success("端点更新成功");
      setShowEndpointDialog(false);
      setEditingEndpoint(null);
      setEndpointForm({
        name: "",
        url: "",
        description: "",
        is_default: false,
        timeout: 300,
      });
      fetchEndpoints();
    } catch (err: any) {
      console.error("更新端点失败:", err);
      toast.error(err.message || "更新端点失败");
    }
  };

  const handleDeleteEndpoint = async (endpointId: number) => {
    if (!confirm("确定要删除这个端点吗？")) return;

    try {
      await aiManagementService.deleteEndpoint(endpointId);
      toast.success("端点删除成功");
      fetchEndpoints();
    } catch (err: any) {
      console.error("删除端点失败:", err);
      toast.error(err.message || "删除端点失败");
    }
  };

  const handleTestEndpoint = async (endpointId?: number) => {
    try {
      const result = await aiManagementService.testEndpoint(endpointId);
      if (result.success) {
        toast.success("端点连接成功");
      } else {
        toast.error(result.error || "端点连接失败");
      }
    } catch (err: any) {
      toast.error(err.message || "端点连接失败");
    }
  };

  const openEndpointDialog = (endpoint?: OllamaEndpoint) => {
    if (endpoint) {
      setEditingEndpoint(endpoint);
      setEndpointForm({
        name: endpoint.name,
        url: endpoint.url,
        description: endpoint.description,
        is_default: endpoint.is_default,
        timeout: endpoint.timeout,
      });
    } else {
      setEditingEndpoint(null);
      setEndpointForm({
        name: "",
        url: "",
        description: "",
        is_default: false,
        timeout: 300,
      });
    }
    setShowEndpointDialog(true);
  };

  // 初始化
  useEffect(() => {
    const initializeData = async () => {
      try {
        await Promise.all([fetchModels(), fetchEndpoints()]);
        await testConnection();
      } finally {
        setLoading(false);
      }
    };

    initializeData();
  }, []);

  const visionModels = models.filter((model) => model.is_vision_capable);
  const activeModels = models.filter((model) => model.is_active);

  return (
    <div className="space-y-6">
      {/* 端点管理对话框 */}
      <Dialog open={showEndpointDialog} onOpenChange={setShowEndpointDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingEndpoint ? "编辑端点" : "创建新端点"}
            </DialogTitle>
            <DialogDescription>配置 Ollama AI 服务的连接端点</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">端点名称</Label>
              <Input
                id="name"
                value={endpointForm.name}
                onChange={(e) =>
                  setEndpointForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="例如：本地Ollama、远程服务器"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">服务地址</Label>
              <Input
                id="url"
                value={endpointForm.url}
                onChange={(e) =>
                  setEndpointForm((prev) => ({ ...prev, url: e.target.value }))
                }
                placeholder="http://localhost:11434"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">描述</Label>
              <Textarea
                id="description"
                value={endpointForm.description}
                onChange={(e) =>
                  setEndpointForm((prev) => ({
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
                value={endpointForm.timeout}
                onChange={(e) =>
                  setEndpointForm((prev) => ({
                    ...prev,
                    timeout: parseInt(e.target.value),
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
                checked={endpointForm.is_default}
                onChange={(e) =>
                  setEndpointForm((prev) => ({
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
              onClick={() => setShowEndpointDialog(false)}
            >
              取消
            </Button>
            <Button
              onClick={() => {
                if (editingEndpoint) {
                  handleUpdateEndpoint();
                } else {
                  handleCreateEndpoint();
                }
              }}
              type="button"
            >
              {editingEndpoint ? "更新" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="models" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="models" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            模型管理
          </TabsTrigger>
          <TabsTrigger value="endpoints" className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            端点管理
          </TabsTrigger>
        </TabsList>

        <TabsContent value="models" className="space-y-6">
          {/* 连接状态和操作 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI 模型管理
              </CardTitle>
              <CardDescription>
                管理和监控 Ollama AI 服务模型，支持视觉模型检测和同步
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 连接状态 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      服务状态
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      {connectionStatus === "checking" && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      {connectionStatus === "connected" && (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      )}
                      {connectionStatus === "failed" && (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-sm">
                        {connectionStatus === "idle"
                          ? "未测试"
                          : connectionStatus === "checking"
                          ? "检测中..."
                          : connectionStatus === "connected"
                          ? "已连接"
                          : "连接失败"}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* 模型统计 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Brain className="h-4 w-4" />
                      模型统计
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>总模型数:</span>
                        <span className="font-medium">{models.length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>活跃模型:</span>
                        <span className="font-medium text-green-600">
                          {activeModels.length}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>视觉模型:</span>
                        <span className="font-medium text-blue-600">
                          {visionModels.length}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 操作按钮 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      操作
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={testConnection}
                      disabled={connectionStatus === "checking"}
                      className="w-full flex items-center gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      测试连接
                    </Button>
                    <Button
                      size="sm"
                      onClick={syncModels}
                      disabled={isSyncing}
                      className="w-full flex items-center gap-2"
                    >
                      {isSyncing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          同步中...
                        </>
                      ) : (
                        <>
                          <Zap className="h-4 w-4" />
                          同步模型
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* 错误信息 */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* 模型列表 */}
          <Card>
            <CardHeader>
              <CardTitle>可用模型</CardTitle>
              <CardDescription>
                当前可用的 AI 模型列表，包括视觉和文本模型
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="ml-2">加载模型列表...</span>
                </div>
              ) : models.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {models.map((model) => (
                    <Card key={model.id} className="relative">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-base leading-tight">
                            {model.display_name}
                          </CardTitle>
                          <div className="flex items-center gap-1">
                            {model.is_active ? (
                              <Badge variant="default" className="text-xs">
                                活跃
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                非活跃
                              </Badge>
                            )}
                            {model.is_vision_capable && (
                              <Badge
                                variant="outline"
                                className="text-xs flex items-center gap-1"
                              >
                                <Eye className="h-3 w-3" />
                                视觉
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">
                            模型名称
                          </p>
                          <p className="text-sm font-mono bg-muted p-1 rounded truncate">
                            {model.name}
                          </p>
                        </div>

                        {model.description && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              描述
                            </p>
                            <p className="text-sm">{model.description}</p>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                          {model.model_size && (
                            <div>
                              <p className="text-xs text-muted-foreground">
                                模型大小
                              </p>
                              <p className="text-sm flex items-center gap-1">
                                <HardDrive className="h-3 w-3" />
                                {model.model_size}
                              </p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs text-muted-foreground">
                              API端点
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {model.api_endpoint
                                .replace("http://", "")
                                .replace("https://", "")}
                            </p>
                          </div>
                        </div>

                        {model.is_vision_capable && (
                          <Alert>
                            <Eye className="h-4 w-4" />
                            <AlertDescription className="text-xs">
                              此模型支持图片分析功能
                            </AlertDescription>
                          </Alert>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">暂无可用模型</h3>
                  <p className="text-muted-foreground mb-4">
                    点击"同步模型"按钮从 Ollama 服务获取最新模型列表
                  </p>
                  <Button onClick={syncModels} disabled={isSyncing}>
                    {isSyncing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        同步中...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        同步模型
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="endpoints" className="space-y-6">
          {/* 端点管理 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    端点管理
                  </CardTitle>
                  <CardDescription>
                    管理 Ollama AI 服务的连接端点，支持多服务器配置
                  </CardDescription>
                </div>
                <Button onClick={() => openEndpointDialog()} type="button">
                  <Plus className="h-4 w-4 mr-2" />
                  添加端点
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {endpoints.length > 0 ? (
                <div className="space-y-4">
                  {endpoints.map((endpoint) => (
                    <Card key={endpoint.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{endpoint.name}</h3>
                              {endpoint.is_default && (
                                <Badge variant="default">默认</Badge>
                              )}
                              {endpoint.is_active ? (
                                <Badge variant="secondary">活跃</Badge>
                              ) : (
                                <Badge variant="outline">非活跃</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground font-mono">
                              {endpoint.url}
                            </p>
                            {endpoint.description && (
                              <p className="text-sm">{endpoint.description}</p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>超时: {endpoint.timeout}秒</span>
                              <span>创建者: {endpoint.created_by}</span>
                              <span>
                                创建时间:{" "}
                                {new Date(endpoint.created_at).toLocaleString()}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleTestEndpoint(endpoint.id)}
                            >
                              测试连接
                            </Button>
                            {(endpoint.is_owner || endpoint.can_delete) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEndpointDialog(endpoint)}
                                title={
                                  endpoint.is_owner
                                    ? "编辑端点"
                                    : "超级用户权限编辑"
                                }
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {endpoint.can_delete && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleDeleteEndpoint(endpoint.id)
                                }
                                title={
                                  endpoint.is_owner
                                    ? "删除端点"
                                    : "超级用户权限删除"
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Server className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">暂无配置的端点</h3>
                  <p className="text-muted-foreground mb-4">
                    添加 Ollama 服务端点来开始使用 AI 分析功能
                  </p>
                  <Button onClick={() => openEndpointDialog()}>
                    <Plus className="h-4 w-4 mr-2" />
                    添加第一个端点
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 端点使用说明 */}
          <Card>
            <CardHeader>
              <CardTitle>端点配置说明</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 mt-0.5 text-green-500" />
                  <div>
                    <strong>服务地址:</strong> Ollama API 的完整 URL，例如
                    http://localhost:11434
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 mt-0.5 text-blue-500" />
                  <div>
                    <strong>默认端点:</strong>{" "}
                    系统会优先使用标记为默认的端点进行 AI 分析
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 mt-0.5 text-purple-500" />
                  <div>
                    <strong>多端点支持:</strong> 可以配置多个 Ollama
                    服务端点，实现负载均衡和容错
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 使用说明 */}
      <Card>
        <CardHeader>
          <CardTitle>使用说明</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 mt-0.5 text-green-500" />
              <div>
                <strong>视觉模型:</strong>{" "}
                支持图片分析，可以生成标题、描述、提示词、分类和标签建议
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 mt-0.5 text-blue-500" />
              <div>
                <strong>模型同步:</strong> 从 Ollama 服务自动检测和同步可用的 AI
                模型
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 mt-0.5 text-purple-500" />
              <div>
                <strong>连接测试:</strong> 验证与 Ollama 服务的连接状态和可用性
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
