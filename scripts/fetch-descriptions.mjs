/**
 * 31권의 책 소개를 교보문고 상품 페이지에서 스크레이핑
 *
 * 흐름:
 *  1. 알라딘 API → ISBN13 획득
 *  2. 교보문고 ISBN URL → 리다이렉트 → 상품 페이지
 *  3. "책 소개" 섹션 파싱
 */

const TTB_KEY = 'ttbwanderwheel1036001'

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

function extractDescription(html) {
  // 교보문고 책 소개 섹션 — 여러 패턴 시도
  const patterns = [
    // intro_bottom 또는 book_intro 안의 텍스트
    /class="[^"]*intro_bottom[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /class="[^"]*book_intro[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    // "책 소개" 헤딩 다음 콘텐츠
    /책\s*소개[\s\S]{0,200}?<[^>]+>([\s\S]*?)<\/(?:div|section|article)>/i,
  ]

  for (const pat of patterns) {
    const m = html.match(pat)
    if (m) {
      return cleanHtml(m[1])
    }
  }

  // 마지막 수단: og:description 메타 태그
  const og = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)
  if (og) return og[1].trim()

  return null
}

function cleanHtml(raw) {
  return raw
    .replace(/<[^>]+>/g, ' ')   // HTML 태그 제거
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#[0-9]+;/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

async function getKyoboPage(isbn) {
  const url = `https://www.kyobobook.co.kr/product/detailViewKor.laf?barcode=${isbn}`
  try {
    const res = await fetch(url, { headers: HEADERS, redirect: 'follow' })
    return await res.text()
  } catch {
    return null
  }
}

async function main() {
  const results = []

  for (const book of BOOKS) {
    const isbn = await getIsbn(book.title, book.itemId)
    await new Promise(r => setTimeout(r, 300))

    if (!isbn) {
      console.log(`❌ no ISBN   ${book.id}`)
      results.push({ id: book.id, desc: null })
      continue
    }

    const html = await getKyoboPage(isbn)
    await new Promise(r => setTimeout(r, 500))

    if (!html) {
      console.log(`❌ fetch fail  ${book.id}`)
      results.push({ id: book.id, desc: null })
      continue
    }

    const desc = extractDescription(html)
    if (desc) {
      const preview = desc.slice(0, 80).replace(/\n/g, ' ')
      console.log(`✅ ${book.id}\n   ${preview}...`)
    } else {
      console.log(`— no desc  ${book.id}  (ISBN: ${isbn})`)
      // HTML 일부 출력해서 구조 파악
      const snippet = html.slice(0, 3000).replace(/\s+/g, ' ')
      console.log(`   HTML snippet: ${snippet.slice(0, 200)}`)
    }
    results.push({ id: book.id, isbn, desc })
  }

  console.log('\n\n── books.ts 반영용 ──\n')
  for (const r of results) {
    if (r.desc) {
      console.log(`  // ${r.id}`)
      console.log(`  description: \`${r.desc.slice(0, 300)}\`,\n`)
    } else {
      console.log(`  // ${r.id}: 설명 없음\n`)
    }
  }
}

main()
