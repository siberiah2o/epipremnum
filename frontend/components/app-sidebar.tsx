import * as React from "react";

import { SearchForm } from "@/components/search-form";
import { VersionSwitcher } from "@/components/version-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

// This is sample data.
const data = {
  versions: ["1.0.0", "1.0.1", "1.1.0-alpha"],
  navMain: [
    {
      title: "仪表板",
      url: "/dashboard",
      items: [
        {
          title: "概览",
          url: "/dashboard",
          isActive: true,
        },
      ],
    },
    {
      title: "媒体管理",
      url: "#",
      items: [
        {
          title: "媒体文件",
          url: "/dashboard/media",
        },
        {
          title: "上传文件",
          url: "/dashboard/media/upload",
        },
        {
          title: "分类管理",
          url: "/dashboard/media/categories",
        },
        {
          title: "标签管理",
          url: "/dashboard/media/tags",
        },
      ],
    },
    {
      title: "新AI工作台",
      url: "#",
      items: [
        {
          title: "图片分析",
          url: "/dashboard/new_ai/analysis",
        },
        {
          title: "批量处理",
          url: "/dashboard/new_ai/batch",
        },
        {
          title: "模型管理",
          url: "/dashboard/new_ai/models",
        },
      ],
    },
    {
      title: "用户管理",
      url: "#",
      items: [
        {
          title: "个人资料",
          url: "/dashboard/profile",
        },
      ],
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <VersionSwitcher
          versions={data.versions}
          defaultVersion={data.versions[0]}
        />
        <SearchForm />
      </SidebarHeader>
      <SidebarContent>
        {/* We create a SidebarGroup for each parent. */}
        {data.navMain.map((item) => (
          <SidebarGroup key={item.title}>
            <SidebarGroupLabel>{item.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {item.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={"isActive" in item ? item.isActive : false}
                    >
                      <a href={item.url}>{item.title}</a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
