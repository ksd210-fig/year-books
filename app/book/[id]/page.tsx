import type { Metadata } from 'next'
import { BOOKS } from '@/data/books'
import BookApp from '../../components/BookApp'
import { BASE_PATH } from '../../basePath'

const SITE_URL = 'https://www.fig1.kr'

export async function generateStaticParams() {
  return BOOKS.map(b => ({ id: b.id }))
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params
  const book = BOOKS.find(b => b.id === id)
  if (!book) return {}

  const title = `${book.titleKo} — Fig.1 Books`
  const description = book.description
  const url = `${SITE_URL}${BASE_PATH}/book/${book.id}`
  const coverImg = book.front ?? book.cover

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: 'Fig.1',
      locale: 'ko_KR',
      type: 'book',
      ...(coverImg ? { images: [{ url: coverImg, width: 400, height: 600, alt: book.titleKo }] } : {}),
    },
    twitter: {
      card: coverImg ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(coverImg ? { images: [coverImg] } : {}),
    },
    alternates: { canonical: url },
  }
}

export default async function BookPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const exists = BOOKS.some(b => b.id === id)
  return <BookApp initialId={exists ? id : null} />
}
