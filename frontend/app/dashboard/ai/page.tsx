"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AIPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the analysis page by default
    router.replace("/dashboard/ai/analysis");
  }, [router]);

  // Simple loading state while redirecting
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-muted-foreground">正在跳转到 AI 分析页面...</p>
      </div>
    </div>
  );
}