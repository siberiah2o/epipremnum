'use client'

import { useState } from 'react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { MediaList } from "@/components/media"
import { MediaEdit } from "@/components/media"
import { MediaListItem } from "@/lib/api"
import { FileIcon } from "@/components/ui/file-icon"
import { isPreviewable } from "@/lib/file-utils"
import { toast } from 'sonner'
import { FileImage, Upload, Download } from 'lucide-react'

export default function MediaPage() {
  const [editingMedia, setEditingMedia] = useState<MediaListItem | null>(null)
  const [viewingMedia, setViewingMedia] = useState<MediaListItem | null>(null)
  const [activeTab, setActiveTab] = useState('list')

  const handleEdit = (media: MediaListItem) => {
    setEditingMedia(media)
    setActiveTab('edit')
  }

  const handleView = (media: MediaListItem) => {
    setViewingMedia(media)
  }

  const handleViewClose = () => {
    setViewingMedia(null)
  }

  const handleDownload = async (media: MediaListItem) => {
    try {
      const response = await fetch(media.file_url)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = media.title
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('文件下载开始')
    } catch (error) {
      toast.error('下载失败')
    }
  }

  const handleEditSuccess = () => {
    setEditingMedia(null)
    setActiveTab('list')
    toast.success('媒体文件更新成功')
  }

  const handleEditClose = () => {
    setEditingMedia(null)
    setActiveTab('list')
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
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground">
              管理您的媒体文件，包括上传、编辑和组织
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="list" className="flex items-center gap-2">
                <FileImage className="h-4 w-4" />
                文件列表
              </TabsTrigger>
              <TabsTrigger value="edit" disabled={!editingMedia} className="flex items-center gap-2">
                编辑文件
              </TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="space-y-4">
              <MediaList
                onEdit={handleEdit}
                onView={handleView}
              />
            </TabsContent>

            <TabsContent value="edit" className="space-y-4">
              {editingMedia && (
                <MediaEdit
                  mediaId={editingMedia.id}
                  onClose={handleEditClose}
                  onSuccess={handleEditSuccess}
                />
              )}
            </TabsContent>
          </Tabs>

        {/* 预览对话框 */}
        <Dialog open={!!viewingMedia} onOpenChange={(open) => !open && handleViewClose()}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{viewingMedia?.title}</DialogTitle>
              <DialogDescription>
                媒体文件预览
              </DialogDescription>
            </DialogHeader>
            {viewingMedia && (
              <div className="space-y-4">
                {isPreviewable(viewingMedia.file_type) ? (
                  viewingMedia.file_type === 'image' ? (
                    <img
                      src={viewingMedia.file_url}
                      alt={viewingMedia.title}
                      className="w-full max-h-96 object-contain rounded"
                    />
                  ) : (
                    <video
                      src={viewingMedia.file_url}
                      controls
                      className="w-full max-h-96 rounded"
                    />
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-muted-foreground/25 rounded-lg">
                    <FileIcon mimeType={viewingMedia.file_type} size="lg" className="mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground mb-2">此文件类型不支持预览</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(viewingMedia)}
                      className="mt-4"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      下载文件
                    </Button>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">文件类型:</span> {viewingMedia.file_type === 'image' ? '图片' : '视频'}
                  </div>
                  <div>
                    <span className="font-medium">文件格式:</span> {viewingMedia.file_url.split('.').pop()?.toUpperCase() || 'Unknown'}
                  </div>
                  <div>
                    <span className="font-medium">文件大小:</span> {(viewingMedia.file_size / 1024 / 1024).toFixed(2)} MB
                  </div>
                  <div>
                    <span className="font-medium">创建时间:</span> {new Date(viewingMedia.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </SidebarInset>
  </SidebarProvider>
)
}