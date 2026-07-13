import type { MetadataRoute } from 'next'
import { BOOKS } from '@/data/books'
import { BASE_PATH } from './basePath'

const BASE = `https://www.fig1.kr${BASE_PATH}`

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
    ...BOOKS.map(book => ({
      url: `${BASE}/book/${book.id}`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ]
}
