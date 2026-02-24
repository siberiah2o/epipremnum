'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Server } from 'lucide-react';

interface BackendErrorFallbackProps {
  onRetry?: () => void;
}

export function BackendErrorFallback({ onRetry }: BackendErrorFallbackProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <Server className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-xl">后端服务未启动</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-muted-foreground">
            无法连接到后端服务 (127.0.0.1:8000)。
            <br />
            请确保后端服务正在运行。
          </p>
          <div className="rounded-md bg-muted p-3 text-sm text-left">
            <p className="font-medium mb-1">启动后端服务:</p>
            <code className="text-xs bg-background px-2 py-1 rounded block">
              cd backend && python manage.py runserver
            </code>
          </div>
          <div className="space-y-2">
            <Button onClick={onRetry} className="w-full" variant="default">
              <RefreshCw className="mr-2 h-4 w-4" />
              重试连接
            </Button>
            <Button
              onClick={() => window.location.reload()}
              className="w-full"
              variant="outline"
            >
              刷新页面
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
