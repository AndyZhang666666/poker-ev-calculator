import type { NextConfig } from "next";

// GitHub Pages 静态导出。全部 EV 计算在浏览器里跑，没有服务端。
// basePath 必须等于仓库名，否则 Pages 上的 /_next/ 资源会全部 404。
const repo = "poker-ev-calculator";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  basePath: `/${repo}`,
  assetPrefix: `/${repo}/`,
  trailingSlash: true,
};

export default nextConfig;
