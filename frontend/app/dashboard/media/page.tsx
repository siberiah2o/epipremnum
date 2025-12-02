'use client'

import { useState } from 'react'
import { useRouteGuard } from "@/hooks/useRouteGuard"
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
import { MediaListWithPagination, MediaEdit, MediaPreviewDialog } from "@/components/media"
import { MediaListItem } from "@/lib/api"
import { useMediaList } from '@/hooks/use-media'
import { toast } from 'sonner'

export default function MediaPage() {
  useRouteGuard() // 添加路由保护
  const [editingMedia, setEditingMedia] = useState<MediaListItem | null>(null)
  const [viewingMedia, setViewingMedia] = useState<MediaListItem | null>(null)

  // 获取媒体列表数据用于预览切换
  const { mediaList, isLoading } = useMediaList()

  const handleEdit = (media: MediaListItem) => {
    setEditingMedia(media)
  }

  const handleView = (media: MediaListItem) => {
    setViewingMedia(media)
  }

  const handleViewClose = () => {
    setViewingMedia(null)
  }

  const handleMediaChange = (media: MediaListItem) => {
    setViewingMedia(media)
  }

  const handleEditSuccess = () => {
    setEditingMedia(null)
    toast.success('媒体文件更新成功')
  }

  const handleEditClose = () => {
    setEditingMedia(null)
  }

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
                <BreadcrumbPage>媒体文件</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          {editingMedia ? (
            <MediaEdit
              mediaId={editingMedia.id}
              onClose={handleEditClose}
              onSuccess={handleEditSuccess}
            />
          ) : (
            <MediaListWithPagination
              onEdit={handleEdit}
              onView={handleView}
            />
          )}

        {/* 预览对话框 */}
        <MediaPreviewDialog
          open={!!viewingMedia}
          onOpenChange={(open) => !open && handleViewClose()}
          media={viewingMedia}
          mediaList={mediaList?.results || []}
          onMediaChange={handleMediaChange}
        />
      </div>
    </SidebarInset>
  </SidebarProvider>
)
}