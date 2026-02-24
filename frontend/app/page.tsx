import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="w-full max-w-md space-y-8 rounded-2xl border bg-white p-8 shadow-lg">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">
            Epipremnum
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            媒体管理与 AI 分析平台
          </p>
        </div>

        <div className="space-y-4">
          <p className="text-center text-sm text-gray-600">
            登录或注册以继续
          </p>

          <Button asChild className="w-full" size="lg">
            <Link href="/login">登录</Link>
          </Button>

          <Button asChild variant="outline" className="w-full" size="lg">
            <Link href="/register">注册</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
