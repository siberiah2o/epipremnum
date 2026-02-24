/**
 * 空状态组件
 * 用于显示无数据时的占位状态
 */
import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileX, Search, FolderOpen, Image, Inbox } from 'lucide-react';

export interface EmptyStateProps {
  /** 图标 */
  icon?: LucideIcon;
  /** 标题 */
  title?: string;
  /** 描述 */
  description?: string;
  /** 操作按钮文本 */
  actionText?: string;
  /** 操作按钮点击 */
  onAction?: () => void;
  /** 自定义内容 */
  children?: ReactNode;
  /** 预设类型 */
  type?: 'default' | 'search' | 'folder' | 'image' | 'inbox';
}

const typeConfig = {
  default: {
    icon: FileX,
    title: '暂无数据',
    description: '这里还没有任何内容',
  },
  search: {
    icon: Search,
    title: '未找到匹配项',
    description: '尝试使用其他关键词搜索',
  },
  folder: {
    icon: FolderOpen,
    title: '暂无文件夹',
    description: '创建一个新文件夹来组织内容',
  },
  image: {
    icon: Image,
    title: '暂无图片',
    description: '上传一些图片开始使用',
  },
  inbox: {
    icon: Inbox,
    title: '收件箱为空',
    description: '暂无新消息',
  },
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionText,
  onAction,
  children,
  type = 'default',
}: EmptyStateProps) {
  const config = typeConfig[type];
  const FinalIcon = Icon || config.icon;
  const finalTitle = title || config.title;
  const finalDescription = description || config.description;

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
        <FinalIcon className="h-8 w-8 text-muted-foreground/50" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {finalTitle}
      </h3>
      {finalDescription && (
        <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
          {finalDescription}
        </p>
      )}
      {actionText && onAction && (
        <Button onClick={onAction} variant="outline">
          {actionText}
        </Button>
      )}
      {children}
    </div>
  );
}
