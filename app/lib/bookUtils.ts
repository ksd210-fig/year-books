export interface BookItem {
  id: string
  titleKo: string
  author: string
  coverColor: string
  edgeColor: string
  textColor: string
  year: string | number
  cover?: string
  mmW?: number
  mmH?: number
  mmD?: number
  back?: string
  spine?: string
}

export const MM_SCALE = 4.5 / 190
export const DEFAULT_W = 3.0
export const DEFAULT_H = 0.55
export const DEFAULT_D = 4.5
export const BOOK_GAP = 0.45

export function bookDims(book: BookItem) {
  const w = book.mmW ? +(book.mmW * MM_SCALE).toFixed(3) : DEFAULT_W
  const d = book.mmH ? +(book.mmH * MM_SCALE).toFixed(3) : DEFAULT_D
  const h = book.mmD ? +(book.mmD * MM_SCALE).toFixed(3) : DEFAULT_H
  return { w, h, d }
}

export function computeYOffsets(books: BookItem[]): number[] {
  const dims = books.map(b => bookDims(b).h)
  const offsets: number[] = [0]
  for (let i = 0; i < books.length - 1; i++) {
    offsets.push(offsets[i] - dims[i] / 2 - dims[i + 1] / 2 - BOOK_GAP)
  }
  return offsets
}
