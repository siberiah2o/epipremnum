'use client';

import { useAuth } from '@/contexts/auth-context';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { ProfileSection } from './components/profile-section';
import { EndpointsTab } from './components/endpoints-tab';
import { ModelsTab } from './components/models-tab';
import { User, Server, Brain } from 'lucide-react';

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Settings Tabs */}
      <Tabs defaultValue="profile" className="flex flex-col flex-1 min-h-0">
        <TabsList className="grid w-full grid-cols-3 h-9 shrink-0">
          <TabsTrigger value="profile" className="text-xs gap-1.5">
            <User className="h-3.5 w-3.5" />
            基本信息
          </TabsTrigger>
          <TabsTrigger value="endpoints" className="text-xs gap-1.5">
            <Server className="h-3.5 w-3.5" />
            API端点
          </TabsTrigger>
          <TabsTrigger value="models" className="text-xs gap-1.5">
            <Brain className="h-3.5 w-3.5" />
            AI模型
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 min-h-0 mt-3 overflow-auto">
          {/* Profile Tab */}
          <TabsContent value="profile" className="mt-0 h-full">
            <ProfileSection user={user} refreshUser={refreshUser} />
          </TabsContent>

          {/* Endpoints Tab */}
          <TabsContent value="endpoints" className="mt-0 h-full">
            <EndpointsTab />
          </TabsContent>

          {/* Models Tab */}
          <TabsContent value="models" className="mt-0 h-full">
            <ModelsTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
