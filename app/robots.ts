import type { MetadataRoute } from 'next'
import { BASE_PATH } from './basePath'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `https://www.fig1.kr${BASE_PATH}/sitemap.xml`,
  }
}
