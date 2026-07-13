// www.fig1.kr/project/year-books 로 서빙되는 이 앱의 고정 경로.
// next/link, next/image, next/font, _next 정적 자산은 next.config의 basePath가
// 자동 처리하지만, raw src 문자열(three.js 텍스처 로더, useTexture 등)은 직접 붙여야 한다.
export const BASE_PATH = "/project/year-books";

export function withBase(path: string): string {
  if (!path || /^https?:\/\//.test(path)) return path; // 이미 절대 URL이면 그대로
  return `${BASE_PATH}${path}`;
}
