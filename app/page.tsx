'use client'

import dynamic from 'next/dynamic'

const BookApp = dynamic(() => import('./components/BookApp'), {
  ssr: false,
  loading: () => <div style={{ background: '#1c1714', height: '100dvh', width: '100%' }} />,
})

export default function Page() {
  return <BookApp />
}
