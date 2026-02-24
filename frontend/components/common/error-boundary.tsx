'use client';

import { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** 自定义回退 UI */
  fallback?: ReactNode;
  /** 错误发生时的回调 */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** 重置按钮文本 */
  resetButtonText?: string;
  /** 是否显示重置按钮 */
  showResetButton?: boolean;
  /** 是否显示首页按钮 */
  showHomeButton?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold mb-2">出现了一些问题</h2>
          <p className="text-muted-foreground text-center max-w-md mb-6">
            {this.state.error?.message || '发生了意外错误，请尝试刷新页面或返回首页。'}
          </p>
          <div className="flex gap-3">
            {this.props.showResetButton !== false && (
              <Button onClick={this.handleReset} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                {this.props.resetButtonText || '重试'}
              </Button>
            )}
            {this.props.showHomeButton !== false && (
              <Button onClick={this.handleGoHome}>
                <Home className="h-4 w-4 mr-2" />
                返回首页
              </Button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * 页面级错误边界
 * 用于包裹整个页面
 */
export function PageErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      showHomeButton
      resetButtonText="刷新页面"
      onError={(error) => {
        // 可以在这里添加错误上报逻辑
        console.error('[PageErrorBoundary]', error);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * 组件级错误边界
 * 用于包裹单个组件
 */
export function ComponentErrorBoundary({
  children,
  componentName,
}: {
  children: ReactNode;
  componentName?: string;
}) {
  return (
    <ErrorBoundary
      showHomeButton={false}
      resetButtonText="重试"
      onError={(error) => {
        console.error(`[ComponentErrorBoundary:${componentName}]`, error);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
