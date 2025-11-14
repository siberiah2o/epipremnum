'use client'

import Link from 'next/link'
import { AppSidebar } from "@/components/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { CategoryManager } from "@/components/media"
import { FolderOpen, ArrowLeft } from 'lucide-react'

export default function MediaCategoriesPage() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/dashboard">
                  仪表板
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/dashboard/media">
                  媒体管理
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>分类管理</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground">
              管理媒体文件的分类，帮助您更好地组织内容
            </p>
            <div className="flex gap-2">
              <Link href="/dashboard/media">
                <Button variant="outline" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  返回文件列表
                </Button>
              </Link>
              <Link href="/dashboard/media/upload">
                <Button variant="outline" className="flex items-center gap-2">
                  上传文件
                </Button>
              </Link>
            </div>
          </div>

          <CategoryManager />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}