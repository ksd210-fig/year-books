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
  { id: 'year-1941',       title: '1941년 일본 홋다 에리' },
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
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'Referer': 'https://www.aladin.co.kr',
}

async function getItemId(title) {
  const url = `https://www.aladin.co.kr/ttb/api/ItemSearch.aspx?ttbkey=${TTB_KEY}&Query=${encodeURIComponent(title)}&QueryType=Title&MaxResults=1&start=1&SearchTarget=Book&output=js&Version=20131101`
  const res = await fetch(url)
  const data = await res.json()
  return data.item?.[0]?.itemId ?? null
}

async function getSizeFromProductPage(itemId) {
  const url = `https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=${itemId}`
  const res = await fetch(url, { headers: HEADERS })
  const html = await res.text()
  // Pattern: NNN*NNN mm  (width*height mm)
  const match = html.match(/(\d{2,4})\*(\d{2,4})mm/)
  if (!match) return null
  return { w: parseInt(match[1]), h: parseInt(match[2]) }
}

async function main() {
  const results = []

  for (const book of BOOKS) {
    let itemId = book.itemId ?? null
    if (!itemId) {
      itemId = await getItemId(book.title)
      await new Promise(r => setTimeout(r, 300))
    }

    if (!itemId) {
      console.log(`❌ no itemId  ${book.id}`)
      results.push({ id: book.id, size: null })
      continue
    }

    const size = await getSizeFromProductPage(itemId)
    await new Promise(r => setTimeout(r, 400))

    if (!size) {
      console.log(`❓ no size   ${book.id}  (itemId=${itemId})`)
      results.push({ id: book.id, size: null })
    } else {
      console.log(`✅ ${book.id}  ${size.w}×${size.h}mm`)
      results.push({ id: book.id, size })
    }
  }

  console.log('\n── 결과 (books.ts 붙여넣기용) ──')
  for (const r of results) {
    if (r.size) {
      // Three.js 단위로 변환: 190mm 높이 → 4.5 (기존 D값 기준)
      // scale: 4.5 / 190 ≈ 0.02368
      const scale = 4.5 / 190
      const tw = +(r.size.w * scale).toFixed(2)
      const th = +(r.size.h * scale).toFixed(2)
      console.log(`  '${r.id}': { w: ${tw}, h: ${th} },  // ${r.size.w}×${r.size.h}mm`)
    } else {
      console.log(`  '${r.id}': null,  // size not found`)
    }
  }
}

main()
