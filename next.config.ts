import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // www.fig1.kr/project/year-books 로 리버스 프록시되므로 이 앱의 정본 경로를
  // 여기로 고정한다. next/link·next/image·_next 정적 자산은 자동으로 이 접두사가
  // 붙지만, three.js 텍스처 로더에 넘기는 raw src는 app/basePath.ts의 withBase()로
  // 직접 붙였다(data/books.ts, Book.tsx).
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
  async redirects() {
    return [
      // 기존 year-books-rose.vercel.app 루트 링크는 basePath 밖이라 자동으로는
      // 404가 나므로, 이 규칙으로 새 정본 경로로 보내 계속 작동하게 한다.
      {
        source: '/',
        destination: '/project/year-books',
        basePath: false,
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
