import type { NextConfig } from "next";

// 从环境变量获取后端配置
const backendHost = process.env.NEXT_PUBLIC_BACKEND_HOST || '192.168.55.133';
const backendPort = process.env.NEXT_PUBLIC_BACKEND_PORT || '8888';
const backendUrl = `http://${backendHost}:${backendPort}`;

const nextConfig: NextConfig = {
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      // 处理带斜杠的API路径
      {
        source: '/api/:path*/',
        destination: `${backendUrl}/api/:path*/`,
      },
      // 处理不带斜杠的API路径，自动添加斜杠
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*/`,
      },
      // 处理媒体资源代理
      {
        source: '/media/:path*',
        destination: `${backendUrl}/media/:path*`,
      },
    ]
  },
};

export default nextConfig;
