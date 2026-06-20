import fs from 'fs'
import path from 'path'
import https from 'https'
import http from 'http'
import { fileURLToPath } from 'url'
import { getAladinTtbKey } from './aladin-env.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TTB_KEY = getAladinTtbKey()
const OUT_DIR = path.join(__dirname, '../public/covers')

const BOOKS = [
  { id: 'year-1000',      title: '세계가 처음 연결되었을 때 1000년' },
  { id: 'year-1215',      title: '1215 마그나카르타의 해' },
  { id: 'year-1417',      title: '1417년 근대의 탄생' },
  { id: 'year-1453',      title: '1453 콘스탄티노플 최후의 날' },
  { id: 'year-1492',      title: '1492년 타자의 은폐' },
  { id: 'year-1493',      title: '1493 찰스 만' },
  { id: 'year-1494',      title: '1494 베니스 회계' },
  { id: 'year-1517',      title: '1517 종교개혁' },
  { id: 'year-1636',      title: '인조 1636' },
  { id: 'year-1789',      title: '1789 평등을 잉태한 자유의 원년' },
  { id: 'year-1790',      title: '1790 낭시 군사반란' },
  { id: 'year-1848',      title: '원치 않은 혁명 1848' },
  { id: 'year-1867',      title: '포르모사 1867' },
  { id: 'year-1898',      title: '풍자화로 보는 세계사 1898' },
  { id: 'year-1913',      title: '1913년 세기의 여름' },
  { id: 'year-1917',      title: '1917년 러시아 혁명 라비노비치' },
  { id: 'year-1918',      title: '1918 쇤플루크' },
  { id: 'year-1919-paris',title: '파리 1919 맥밀런' },
  { id: 'year-1919-korea',title: '1919 대한민국의 첫 번째 봄 박찬승' },
  { id: 'year-1927',      title: '여름 1927 미국 빌 브라이슨' },
  { id: 'year-1929-crash',title: '1929 앤드루 로스 소킨' },
  { id: 'year-1929-1939', title: '증오의 시대 광기의 사랑 플로리안 일리스' },
  { id: 'year-1937',      title: '1937 헤미 요' },
  { id: 'year-1941',      title: '1941년 일본 홋다 에리' },
  { id: 'year-1945',      title: '1945 마이클 돕스' },
  { id: 'year-1947',      title: '1947 현재의 탄생 오스브링크' },
  { id: 'year-1962',      title: '1962 쿠바 미사일 위기 마이클 돕스' },
  { id: 'year-1964',      title: '프리덤 서머 1964' },
  { id: 'year-1968',      title: '1968년 저항' },
  { id: 'year-1975',      title: '1975 이야기 유신 언론' },
  { id: 'year-1991',      title: '1991 소련 붕괴 마이클 돕스' },
]

async function searchCoverUrl(title) {
  const url = `https://www.aladin.co.kr/ttb/api/ItemSearch.aspx?ttbkey=${TTB_KEY}&Query=${encodeURIComponent(title)}&QueryType=Title&MaxResults=1&start=1&SearchTarget=Book&output=js&Version=20131101`
  const res = await fetch(url)
  const text = await res.text()
  try {
    const data = JSON.parse(text)
    const coverUrl = data.item?.[0]?.cover
    if (!coverUrl) return null
    // coversum → cover500 으로 교체해 큰 이미지 사용
    return coverUrl.replace('coversum', 'cover500').replace('coverlist', 'cover500')
  } catch {
    return null
  }
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http
    const file = fs.createWriteStream(dest)
    proto.get(url, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close()
        fs.unlinkSync(dest)
        download(res.headers.location, dest).then(resolve).catch(reject)
        return
      }
      res.pipe(file)
      file.on('finish', () => { file.close(); resolve() })
    }).on('error', err => {
      fs.unlinkSync(dest)
      reject(err)
    })
  })
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

  for (const book of BOOKS) {
    const dest = path.join(OUT_DIR, `${book.id}.jpg`)
    if (fs.existsSync(dest)) {
      console.log(`⏭  skip  ${book.id}`)
      continue
    }
    try {
      const coverUrl = await searchCoverUrl(book.title)
      if (!coverUrl) { console.log(`❌ not found  ${book.id}`); continue }
      await download(coverUrl, dest)
      console.log(`✅ saved  ${book.id}  ← ${coverUrl}`)
    } catch (e) {
      console.log(`❌ error  ${book.id}  ${e.message}`)
    }
    await new Promise(r => setTimeout(r, 300)) // API rate limit 방지
  }
  console.log('\n완료!')
}

main()
