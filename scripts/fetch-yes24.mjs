/**
 * 예스24에서 책 이미지(앞표지·뒤표지·책등) 고해상도로 수집
 *
 * 이미지 URL 패턴:
 *   앞표지: https://image.yes24.com/goods/{id}/XL         (856×1200 내외)
 *   뒤표지: https://image.yes24.com/goods/{id}/BACK/XL
 *   책등:   https://image.yes24.com/goods/{id}/SIDE/XL
 *
 * 출력:
 *   public/fronts/{bookId}.jpg
 *   public/backs/{bookId}.jpg
 *   public/spines/{bookId}.jpg
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC = path.resolve(__dirname, '../public')

const BOOKS = [
  { id: 'year-1000',             yes24Id: '108696675' },
  { id: 'year-1215',             yes24Id: '1504402' },
  { id: 'year-1417',             yes24Id: '8884578' },
  { id: 'year-1453',             yes24Id: '1412294' },
  { id: 'year-1492',             yes24Id: '5180150' },
  { id: 'year-1493',             yes24Id: '87662565' },
  { id: 'year-1494',             yes24Id: '4520293' },
  { id: 'year-1517',             yes24Id: '53859240' },
  { id: 'year-1636',             yes24Id: '117752782' },
  { id: 'year-1789',             yes24Id: '23441447' },
  { id: 'year-1790',             yes24Id: '32948499' },
  { id: 'year-1848',             yes24Id: '2356200' },
  { id: 'year-1867',             yes24Id: '120775370' },
  { id: 'year-1898',             yes24Id: '37208649' },
  { id: 'year-1913',             yes24Id: '11188552' },
  { id: 'year-1917',             yes24Id: '44133717' },
  { id: 'year-1918',             yes24Id: '76491856' },
  { id: 'year-1919-paris',       yes24Id: '167405652' },
  { id: 'year-1919-korea',       yes24Id: '71849200' },
  { id: 'year-1927',             yes24Id: '13701293' },
  { id: 'year-1929-crash',       yes24Id: '58258931' },
  { id: 'year-1929-1939',        yes24Id: '127010361' },
  { id: 'year-1937',             yes24Id: null },  // Yes24에 없음 (특수 제목 1·9·3·7)
  { id: 'year-1941',             yes24Id: '185816387' },
  { id: 'year-1945',             yes24Id: '61491030' },
  { id: 'year-1947',             yes24Id: '79256344' },
  { id: 'year-1962',             yes24Id: '75188211' },
  { id: 'year-1964',             yes24Id: '14204001' },
  { id: 'year-1968',             yes24Id: '186035' },
  { id: 'year-1968-jungdaesung', yes24Id: '69294343' },
  { id: 'year-1975',             yes24Id: '8886115' },
  { id: 'year-1991',             yes24Id: '89478731' },
]

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,*/*',
  'Accept-Language': 'ko-KR,ko;q=0.9',
}

async function downloadImage(url, dest) {
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) return false
  const ct = res.headers.get('content-type') ?? ''
  if (!ct.includes('image')) return false
  const buf = await res.arrayBuffer()
  fs.writeFileSync(dest, Buffer.from(buf))
  return true
}

async function main() {
  const results = []

  for (const book of BOOKS) {
    const yes24Id = book.yes24Id

    if (!yes24Id) {
      console.log(`❌ not found  ${book.id}`)
      results.push({ id: book.id, yes24Id: null })
      continue
    }

    console.log(`🔍 ${book.id}  →  yes24 #${yes24Id}`)

    const frontUrl = `https://image.yes24.com/goods/${yes24Id}/XL`
    const backUrl  = `https://image.yes24.com/goods/${yes24Id}/BACK/XL`
    const sideUrl  = `https://image.yes24.com/goods/${yes24Id}/SIDE/XL`

    const frontOk = await downloadImage(frontUrl, path.join(PUBLIC, 'fronts', `${book.id}.jpg`))
    await new Promise(r => setTimeout(r, 200))
    const backOk  = await downloadImage(backUrl,  path.join(PUBLIC, 'backs',  `${book.id}.jpg`))
    await new Promise(r => setTimeout(r, 200))
    const sideOk  = await downloadImage(sideUrl,  path.join(PUBLIC, 'spines', `${book.id}.jpg`))
    await new Promise(r => setTimeout(r, 300))

    const parts = [frontOk && 'front', backOk && 'back', sideOk && 'spine'].filter(Boolean)
    console.log(`   ✅ ${parts.join(', ')}`)
    results.push({ id: book.id, yes24Id, front: frontOk, back: backOk, spine: sideOk })
  }

  console.log('\n── 결과 요약 ──')
  for (const r of results) {
    if (!r.yes24Id) {
      console.log(`  ❌ ${r.id}  (예스24 검색 실패)`)
    } else {
      const missing = ['front', 'back', 'spine'].filter(k => !r[k])
      const ok = missing.length === 0 ? '✅' : '⚠️'
      console.log(`  ${ok} ${r.id}  yes24:${r.yes24Id}  ${missing.length ? `없음: ${missing.join(', ')}` : ''}`)
    }
  }
}

main()
