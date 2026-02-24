'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TagsPage() {
  const router = useRouter();

  useEffect(() => {
    // 标签功能已移除，重定向到分类页面
    router.replace('/dashboard/media/categories');
  }, [router]);

  return null;
}
