import type { MetadataRoute } from 'next'
import { BOOKS } from '@/data/books'

const BASE = 'https://year-books-rose.vercel.app'

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
