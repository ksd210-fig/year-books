import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // www.fig1.kr/project/year-books 로 리버스 프록시되므로, _next 정적 자산과
  // 내부 링크가 그 경로 아래에서 풀리도록 basePath를 맞춘다.
  basePath: '/project/year-books',
  outputFileTracingRoot: projectRoot,
  allowedDevOrigins: ['172.16.241.101'],
  turbopack: { root: projectRoot },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'covers.openlibrary.org' },
      { protocol: 'https', hostname: 'image.aladin.co.kr' },
    ],
  },
};

export default nextConfig;
