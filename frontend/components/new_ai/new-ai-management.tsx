"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, Server } from "lucide-react";
import { ModelManagement } from "./components/model-management";
import { EndpointManagement } from "./components/endpoint-management";

export function NewAIManagement() {
  return (
    <div className="space-y-4">
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

        <TabsContent value="models" className="space-y-4">
          <ModelManagement />
        </TabsContent>

        <TabsContent value="endpoints" className="space-y-4">
          <EndpointManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}