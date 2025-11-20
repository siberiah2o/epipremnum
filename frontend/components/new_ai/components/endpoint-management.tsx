import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Server } from "lucide-react";
import { EndpointCard } from "./endpoint-card";
import { EndpointDialog } from "./endpoint-dialog";
import { EmptyState } from "./empty-state";
import { useAIEndpoints } from "../hooks/use-ai-endpoints";
import { OllamaEndpoint, CreateEndpointRequest } from "../types/ai";

export function EndpointManagement() {
  const {
    endpoints,
    loading,
    createEndpoint,
    updateEndpoint,
    deleteEndpoint,
    testEndpoint,
  } = useAIEndpoints();

  const [showDialog, setShowDialog] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState<OllamaEndpoint | null>(null);

  // 打开端点对话框
  const openEndpointDialog = (endpoint?: OllamaEndpoint) => {
    setEditingEndpoint(endpoint || null);
    setShowDialog(true);
  };

  // 处理端点提交
  const handleEndpointSubmit = async (data: CreateEndpointRequest) => {
    if (editingEndpoint) {
      return await updateEndpoint(editingEndpoint.id, data);
    } else {
      return await createEndpoint(data);
    }
  };

  return (
    <div className="space-y-4">
      {/* 端点管理 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Server className="h-4 w-4" />
                端点管理
              </CardTitle>
            </div>
            <Button size="sm" onClick={() => openEndpointDialog()} type="button">
              <Plus className="h-3 w-3 mr-1" />
              添加端点
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {!loading && endpoints.length > 0 ? (
            <div className="space-y-3">
              {endpoints.map((endpoint, index) => (
                <EndpointCard
                  key={index}
                  endpoint={endpoint}
                  index={index}
                  onEdit={openEndpointDialog}
                  onDelete={deleteEndpoint}
                  onTest={testEndpoint}
                />
              ))}
            </div>
          ) : !loading ? (
            <EmptyState
              type="endpoints"
              onAction={() => openEndpointDialog()}
            />
          ) : null}
        </CardContent>
      </Card>

      {/* 端点对话框 */}
      <EndpointDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        endpoint={editingEndpoint}
        onSubmit={handleEndpointSubmit}
      />
    </div>
  );
}