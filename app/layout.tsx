import type { Metadata } from 'next'
import { EB_Garamond } from 'next/font/google'
import { BOOKS } from '@/data/books'
import './globals.css'

const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['normal', 'italic'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: '연도의 책들 — Fig.1',
  description: '연도가 제목인 책들의 아카이브. 역사의 결정적 순간을 담은 책들을 모았습니다.',
  metadataBase: new URL('https://year-books-rose.vercel.app'),
  openGraph: {
    title: '연도의 책들 — Fig.1',
    description: '연도가 제목인 책들의 아카이브. 역사의 결정적 순간을 담은 책들을 모았습니다.',
    url: 'https://year-books-rose.vercel.app',
    siteName: 'Fig.1',
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '연도의 책들 — Fig.1',
    description: '연도가 제목인 책들의 아카이브. 역사의 결정적 순간을 담은 책들을 모았습니다.',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: '연도의 책들 — Fig.1',
  description: '연도가 제목인 책들의 아카이브. 역사의 결정적 순간을 담은 책들을 모았습니다.',
  url: 'https://year-books-rose.vercel.app',
  mainEntity: {
    '@type': 'ItemList',
    itemListElement: BOOKS.map((book, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Book',
        name: book.titleKo,
        ...(book.titleEn ? { alternateName: book.titleEn } : {}),
        author: { '@type': 'Person', name: book.author },
        publisher: { '@type': 'Organization', name: book.publisher },
        inLanguage: 'ko',
        ...(book.buyLink ? { url: book.buyLink } : {}),
      },
    })),
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={ebGaramond.className}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
