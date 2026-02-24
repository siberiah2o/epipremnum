'use client';

import { useState, useEffect, useMemo } from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { usePathname } from 'next/navigation';

const routeTitles: Record<string, string> = {
  '/dashboard': '仪表盘',
  '/dashboard/media': '媒体库',
  '/dashboard/media/categories': '分类管理',
  '/dashboard/media/tags': '标签管理',
  '/dashboard/media/upload': '上传文件',
  '/dashboard/tasks': '任务管理',
  '/dashboard/projects': '项目库',
  '/dashboard/settings': '设置',
};

export function Header() {
  const pathname = usePathname();
  const [projectInfo, setProjectInfo] = useState<{ name: string; description: string } | null>(null);

  // 使用 useMemo 缓存 projectId，避免无限循环
  const projectId = useMemo(() => {
    const match = pathname.match(/^\/dashboard\/projects\/(\d+)$/);
    return match ? match[1] : null;
  }, [pathname]);

  // 获取项目信息
  useEffect(() => {
    if (projectId) {
      fetch(`/api/projects/${projectId}/`)
        .then(res => res.json())
        .then(data => {
          if (data.code === 200 && data.data) {
            setProjectInfo({
              name: data.data.name,
              description: data.data.description || '',
            });
          }
        })
        .catch(() => {
          setProjectInfo(null);
        });
    } else {
      setProjectInfo(null);
    }
  }, [projectId]);

  // 构建面包屑
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs = segments.map((segment, index) => {
    const path = '/' + segments.slice(0, index + 1).join('/');
    const isLast = index === segments.length - 1;
    // 如果是项目详情页面且是最后一个，显示项目名称
    let label = routeTitles[path] || segment;
    if (isLast && projectId && projectInfo) {
      label = projectInfo.name;
    }
    return {
      label,
      path,
      isLast,
    };
  });

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.path} className="flex items-center gap-1">
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {crumb.isLast ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <a href={crumb.path}>{crumb.label}</a>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </div>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      {/* 项目描述 */}
      {projectInfo && projectInfo.description && (
        <>
          <Separator orientation="vertical" className="mx-2 h-4" />
          <span className="text-sm text-muted-foreground truncate max-w-md">
            {projectInfo.description}
          </span>
        </>
      )}
    </header>
  );
}
