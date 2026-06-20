/**
 * 31권의 두께(mm)를 교보문고 상품 페이지에서 스크레이핑
 *
 * 흐름:
 *  1. 알라딘 API → ISBN13 획득
 *  2. 교보문고 ISBN URL → 리다이렉트 → 상품 페이지
 *  3. 상품 페이지에서 "W * H * D mm" 패턴 파싱
 */

import { getAladinTtbKey } from './aladin-env.mjs'

const TTB_KEY = getAladinTtbKey()

const BOOKS = [
  { id: 'year-1000',       title: '세계가 처음 연결되었을 때 1000년' },
  { id: 'year-1215',       title: '1215 마그나카르타의 해' },
  { id: 'year-1417',       title: '1417년 근대의 탄생' },
  { id: 'year-1453',       title: '1453 콘스탄티노플 최후의 날' },
  { id: 'year-1492',       title: '1492년 타자의 은폐' },
  { id: 'year-1493',       title: '1493 찰스 만' },
  { id: 'year-1494',       title: '1494 베니스 회계' },
  { id: 'year-1517',       title: '1517 종교개혁' },
  { id: 'year-1636',       title: '인조 1636' },
  { id: 'year-1789',       title: '1789 평등을 잉태한 자유의 원년' },
  { id: 'year-1790',       title: '1790 낭시 군사반란' },
  { id: 'year-1848',       title: '원치 않은 혁명 1848' },
  { id: 'year-1867',       title: '포르모사 1867' },
  { id: 'year-1898',       title: '풍자화로 보는 세계사 1898' },
  { id: 'year-1913',       title: '1913년 세기의 여름' },
  { id: 'year-1917',       title: '1917년 러시아 혁명 라비노비치' },
  { id: 'year-1918',       title: '1918 쇤플루크' },
  { id: 'year-1919-paris', title: '파리 1919 맥밀런' },
  { id: 'year-1919-korea', title: '1919 대한민국의 첫 번째 봄 박찬승' },
  { id: 'year-1927',       title: '여름 1927 미국 빌 브라이슨' },
  { id: 'year-1929-crash', title: '1929 앤드루 로스 소킨' },
  { id: 'year-1929-1939',  title: '증오의 시대 광기의 사랑 플로리안 일리스' },
  { id: 'year-1937',       title: '1937 헤미 요', itemId: '241299961' },
  { id: 'year-1941',       title: '1941년 일본 홋다 에리', itemId: '391962459' },
  { id: 'year-1945',       title: '1945 마이클 돕스' },
  { id: 'year-1947',       title: '1947 현재의 탄생 오스브링크' },
  { id: 'year-1962',       title: '1962 쿠바 미사일 위기 마이클 돕스' },
  { id: 'year-1964',       title: '프리덤 서머 1964' },
  { id: 'year-1968',       title: '1968년 저항' },
  { id: 'year-1975',       title: '1975 이야기 유신 언론' },
  { id: 'year-1991',       title: '1991 소련 붕괴 마이클 돕스' },
]

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,*/*',
  'Accept-Language': 'ko-KR,ko;q=0.9',
}

async function getIsbn(title, itemId) {
  const url = itemId
    ? `https://www.aladin.co.kr/ttb/api/ItemLookUp.aspx?ttbkey=${TTB_KEY}&itemIdType=ItemId&ItemId=${itemId}&output=js&Version=20131101`
    : `https://www.aladin.co.kr/ttb/api/ItemSearch.aspx?ttbkey=${TTB_KEY}&Query=${encodeURIComponent(title)}&QueryType=Title&MaxResults=1&start=1&SearchTarget=Book&output=js&Version=20131101`
  const res = await fetch(url)
  const data = await res.json()
  return data.item?.[0]?.isbn13 ?? null
}

async function getThicknessFromKyobo(isbn) {
  const url = `https://www.kyobobook.co.kr/product/detailViewKor.laf?barcode=${isbn}`
  const res = await fetch(url, { headers: HEADERS, redirect: 'follow' })
  const html = await res.text()

  // 패턴: "120\n  *\n  180\n  *\n  30\n  mm" or "120 * 180 * 30mm" or "120*180*30mm"
  const m = html.match(/(\d{2,4})\s*\*\s*(\d{2,4})\s*\*\s*(\d{1,3})\s*mm/i)
  if (m) return { w: parseInt(m[1]), h: parseInt(m[2]), d: parseInt(m[3]) }

  // 줄바꿈 포함 패턴 (교보문고 실제 HTML)
  const m2 = html.match(/(\d{2,4})\s*[\r\n\s]*\*[\r\n\s]*(\d{2,4})[\r\n\s]*\*[\r\n\s]*(\d{1,3})[\r\n\s]*\n?\s*mm/i)
  if (m2) return { w: parseInt(m2[1]), h: parseInt(m2[2]), d: parseInt(m2[3]) }

  return null
}

async function main() {
  const results = []

  for (const book of BOOKS) {
    const isbn = await getIsbn(book.title, book.itemId)
    await new Promise(r => setTimeout(r, 300))

    if (!isbn) {
      console.log(`❌ no ISBN   ${book.id}`)
      results.push({ id: book.id, dims: null })
      continue
    }

    const dims = await getThicknessFromKyobo(isbn)
    await new Promise(r => setTimeout(r, 400))

    if (dims) {
      console.log(`✅ ${book.id}  ${dims.w}×${dims.h}×${dims.d}mm  (ISBN: ${isbn})`)
    } else {
      console.log(`— no dims  ${book.id}  (ISBN: ${isbn})`)
    }
    results.push({ id: book.id, isbn, dims })
  }

  console.log('\n── books.ts 반영용 ──')
  for (const r of results) {
    if (r.dims) {
      const scale = 4.5 / 190
      const td = +(r.dims.d * scale).toFixed(3)
      console.log(`  '${r.id}': mmD: ${r.dims.d},  // Three.js H ≈ ${td}`)
    } else {
      console.log(`  '${r.id}': mmD: null,`)
    }
  }
}

main()
