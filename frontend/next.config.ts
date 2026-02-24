import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // 图片通过 Next.js API 路由代理，无需配置远程模式
    remotePatterns: [],
    // 图片优化配置
    formats: ['image/avif', 'image/webp'],
    // 设备尺寸断点，用于响应式图片
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    // 图片尺寸断点
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // 最小缓存 TTL（秒）
    minimumCacheTTL: 60,
  },
  // 实验性功能
  experimental: {
    // 优化包导入
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
};

export default nextConfig;
