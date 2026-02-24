'use client';

import { SidebarProvider as SidebarProviderUi, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './app-sidebar';
import { Header } from './header';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProviderUi>
      <AppSidebar />
      <SidebarInset>
        <Header />
        <div className="flex flex-1 flex-col gap-4 p-4">
          {children}
        </div>
      </SidebarInset>
    </SidebarProviderUi>
  );
}
