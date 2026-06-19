import fs from 'fs'
import path from 'path'
import https from 'https'
import http from 'http'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TTB_KEY = 'ttbwanderwheel1036001'
const BACK_DIR = path.join(__dirname, '../public/backs')
const FRONT_DIR = path.join(__dirname, '../public/fronts')  // letslook front (higher res)

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

async function getCoverUrl(title, itemId) {
  const url = itemId
    ? `https://www.aladin.co.kr/ttb/api/ItemLookUp.aspx?ttbkey=${TTB_KEY}&itemIdType=ItemId&ItemId=${itemId}&output=js&Version=20131101`
    : `https://www.aladin.co.kr/ttb/api/ItemSearch.aspx?ttbkey=${TTB_KEY}&Query=${encodeURIComponent(title)}&QueryType=Title&MaxResults=1&start=1&SearchTarget=Book&output=js&Version=20131101`
  const res = await fetch(url)
  const data = await res.json()
  return data.item?.[0]?.cover ?? null
}

// cover URL 예: https://image.aladin.co.kr/product/24129/99/cover500/k292639633_1.jpg
// letslook 예: https://image.aladin.co.kr/product/24129/99/letslook/k292639633_b.jpg
function toLookUrl(coverUrl, suffix) {
  // extract product path and key
  const m = coverUrl.match(/\/product\/(\d+\/\d+)\/[^/]+\/([^_]+)_/)
  if (!m) return null
  return `https://image.aladin.co.kr/product/${m[1]}/letslook/${m[2]}${suffix}`
}

function checkExists(url) {
  return new Promise(resolve => {
    const req = https.request(url, { method: 'HEAD' }, res => {
      resolve(res.statusCode === 200)
    })
    req.on('error', () => resolve(false))
    req.end()
  })
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http
    const file = fs.createWriteStream(dest)
    proto.get(url, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close(); fs.unlinkSync(dest)
        download(res.headers.location, dest).then(resolve).catch(reject)
        return
      }
      if (res.statusCode !== 200) {
        file.close(); fs.unlinkSync(dest)
        reject(new Error(`HTTP ${res.statusCode}`))
        return
      }
      res.pipe(file)
      file.on('finish', () => { file.close(); resolve() })
    }).on('error', err => { try { fs.unlinkSync(dest) } catch {} reject(err) })
  })
}

async function main() {
  for (const dir of [BACK_DIR, FRONT_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  }

  const results = { back: [], noBack: [] }

  for (const book of BOOKS) {
    const coverUrl = await getCoverUrl(book.title, book.itemId)
    await new Promise(r => setTimeout(r, 300))

    if (!coverUrl) {
      console.log(`❌ no cover URL  ${book.id}`)
      results.noBack.push(book.id)
      continue
    }

    const backUrl = toLookUrl(coverUrl, '_b.jpg')
    const frontUrl = toLookUrl(coverUrl, '_f.jpg')

    if (!backUrl) {
      console.log(`❓ parse fail  ${book.id}  (${coverUrl})`)
      results.noBack.push(book.id)
      continue
    }

    const hasBack = await checkExists(backUrl)
    await new Promise(r => setTimeout(r, 200))

    if (hasBack) {
      const backDest = path.join(BACK_DIR, `${book.id}.jpg`)
      const frontDest = path.join(FRONT_DIR, `${book.id}.jpg`)
      try {
        await download(backUrl, backDest)
        await download(frontUrl, frontDest)
        console.log(`✅ ${book.id}  back+front saved`)
        results.back.push(book.id)
      } catch (e) {
        console.log(`❌ download error  ${book.id}  ${e.message}`)
        results.noBack.push(book.id)
      }
    } else {
      console.log(`— no letslook   ${book.id}`)
      results.noBack.push(book.id)
    }
    await new Promise(r => setTimeout(r, 300))
  }

  console.log(`\n✅ 뒷면 있음 (${results.back.length}권): ${results.back.join(', ')}`)
  console.log(`— 뒷면 없음 (${results.noBack.length}권): ${results.noBack.join(', ')}`)
}

main()
