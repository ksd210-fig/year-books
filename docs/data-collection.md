# 데이터 수집 프로세스

`data/books.ts`의 서지 정보 및 `public/` 이미지를 어떻게 수집했는지 기록한다.

---

## 1. 앞표지 이미지 (`public/covers/`)

**출처:** 알라딘 OpenAPI  
**스크립트:** `scripts/fetch-covers.mjs`  
**API 키:** `ttbwanderwheel1036001`

### 흐름
1. `ItemSearch` API로 책 제목 검색 → `cover` URL 획득
2. URL의 `coversum` / `coverlist` → `cover500` 으로 교체 (고해상도)
3. 로컬에 `/covers/{id}.jpg` 로 저장

```
GET https://www.aladin.co.kr/ttb/api/ItemSearch.aspx
  ?ttbkey={KEY}&Query={제목}&QueryType=Title&MaxResults=1
  &SearchTarget=Book&output=js&Version=20131101
```

### 예외
- `year-1937` (1·9·3·7, 헤미 요): 검색 실패 → ItemId `241299961`로 `ItemLookUp` API 직접 조회

---

## 2. 고해상도 앞표지 + 뒷면 이미지 (`public/fronts/`, `public/backs/`)

**출처:** 알라딘 상품 페이지 letslook 이미지  
**스크립트:** `scripts/fetch-backs.mjs`

### URL 패턴
알라딘 `cover500` URL에서 키코드를 추출해 letslook URL 구성:

```
cover500: https://image.aladin.co.kr/product/{p1}/{p2}/cover500/{key}_1.jpg
→ front:  https://image.aladin.co.kr/product/{p1}/{p2}/letslook/{key}_f.jpg
→ back:   https://image.aladin.co.kr/product/{p1}/{p2}/letslook/{key}_b.jpg
```

### 결과
- 31권 중 **27권** letslook 존재 → `/fronts/` + `/backs/` 저장
- 4권 없음: `year-1215`, `year-1790`, `year-1848`, `year-1968`
  → 이 4권은 `/covers/` 그대로 사용, 뒷면 없음

### Three.js 적용
- `page.tsx`의 `HAS_LETSLOOK` Set으로 분기
- 앞표지: letslook 있으면 `/fronts/`, 없으면 `/covers/`
- 뒷면: `material-5` (-Z face), letslook 있는 경우만 텍스처 적용

---

## 3. 책 크기 정보 — 너비·높이 (`mmW`, `mmH`)

**출처:** 알라딘 상품 페이지 (HTML 스크레이핑)  
**스크립트:** `scripts/fetch-sizes.mjs`

### 방법
- 알라딘 API로 ItemId 획득 → 상품 페이지 직접 요청 (브라우저 User-Agent 필요)
- `.conts_info_list1` 영역에서 `NNN*NNNmm` 패턴 파싱

```html
<div class="conts_info_list1">
  <ul><li>532쪽</li><li>128*190mm</li><li>486g</li>...</ul>
</div>
```

### Three.js 스케일
기준: `190mm(높이) → D=4.5 Three.js units`

```
MM_SCALE = 4.5 / 190 ≈ 0.02368
Three.js W = mmW × MM_SCALE
Three.js D = mmH × MM_SCALE
```

---

## 4. 책 두께 (`mmD`)

### 1차: 교보문고 스크레이핑 (25권)
**출처:** 교보문고 상품 페이지  
**스크립트:** `scripts/fetch-thickness.mjs`

```
https://www.kyobobook.co.kr/product/detailViewKor.laf?barcode={ISBN13}
→ 리다이렉트 → https://product.kyobobook.co.kr/detail/S{id}
```

페이지 내 `W * H * D mm` 패턴 파싱 (줄바꿈 포함).  
ISBN은 알라딘 API `isbn13` 필드에서 획득.

### 2차: 무게 기반 추정 (6권)
교보 데이터 없는 6권: `year-1215`, `year-1453`, `year-1789`, `year-1848`, `year-1929-crash`, `year-1975`

알라딘 상품 페이지의 무게(g) + 이미 수집한 너비·높이로 추정:

```
두께(mm) = 무게(g) / (너비(cm) × 높이(cm) × 0.85g/cm³)
```

검증: `year-1937` 486g → 추정 23.5mm, 실측 27mm (오차 ~15%)

`books.ts`에 추정값 표시: `mmD: 21, // estimated from weight`

### Three.js 적용
```
Three.js H(두께) = mmD × MM_SCALE
```

---

## 5. 척등 이미지 (`public/spines/`)

**출처:** 알라딘 상품 페이지 spineflip 이미지  
**스크립트:** `scripts/fetch-spines.mjs`

### URL 패턴
알라딘 API의 `cover` URL에서 spineflip URL로 변환:

```
cover:     https://image.aladin.co.kr/product/{p1}/{p2}/coversum/{key}_3.jpg
→ spine:   https://image.aladin.co.kr/product/{p1}/{p2}/spineflip/{key}_d.jpg
```

변환 규칙:
- `cover(sum|list|500)` → `spineflip`
- `_\d+\.jpg` → `_d.jpg`

### 이미지 특성
- 세로형 portrait (예: 98×729px) — 서가에 세운 책의 책등 기준
- 3D씬에서 `Math.PI / 2` 회전으로 가로 방향으로 변환해 적용

### 결과
- 31권 중 **22권** spineflip 존재 → `/spines/` 저장
- 없는 9권 (404 or not found):
  - `year-1215`, `year-1453`, `year-1494`, `year-1848`, `year-1927` — 404
  - `year-1964`, `year-1968`, `year-1975` — 404
  - `year-1937` (1·9·3·7, 헤미 요) — 알라딘 검색 자체 불가 (특수 제목)

### Three.js 적용

**face 배치 (rotation PI/2, PI/2, -PI/2 기준):**

BoxGeometry face index → world 방향:

| material | local face | world 방향 | 역할 |
|----------|-----------|-----------|------|
| material-0 | +X | -Z (카메라 반대) | 페이지 단면 (크림) |
| material-1 | -X | **+Z (카메라 정면)** | **척등 이미지/텍스트** |
| material-2 | +Y | -Y (아래) | 앞표지 (선택 시 정면) |
| material-3 | -Y | +Y (위에서 보임) | 뒷면 |
| material-4 | +Z | -X (왼쪽) | 측면 |
| material-5 | -Z | +X (오른쪽) | 측면 |

**척등 이미지 적용:**
- `HAS_SPINE` Set으로 분기
- spine 있음: `ImageCoverMaterial attach="material-1" rotation={Math.PI / 2}`
- spine 없음: canvas `spineTex` (책 제목 텍스트, 1024×H/D 비율)

**spineTex 캔버스 비율:**  
material-1 (카메라 정면 면)의 UV는 D×H (책 높이 × 두께)에 대응:
```
canvas width  = 1024
canvas height = Math.round(1024 * H / D)   // H=두께(27mm), D=높이(190mm) → 매우 가로 납작
```

---

## 6. 파일 구조 요약

```
public/
  covers/   # 31권 — 알라딘 cover500 (기본)
  fronts/   # 27권 — 알라딘 letslook _f.jpg (고해상도)
  backs/    # 27권 — 알라딘 letslook _b.jpg (뒷면)
  spines/   # 22권 — 알라딘 spineflip _d.jpg (척등)

data/
  books.ts  # mmW / mmH / mmD 필드 포함

scripts/
  fetch-covers.mjs     # covers/ 수집
  fetch-sizes.mjs      # mmW, mmH 수집
  fetch-thickness.mjs  # mmD 수집 (교보문고)
  fetch-backs.mjs      # fronts/, backs/ 수집
  fetch-spines.mjs     # spines/ 수집
```

---

## 7. 알라딘 API 참고

| API | 엔드포인트 | 주요 파라미터 |
|-----|-----------|-------------|
| ItemSearch | `/ttb/api/ItemSearch.aspx` | `Query`, `QueryType=Title` |
| ItemLookUp | `/ttb/api/ItemLookUp.aspx` | `itemIdType=ItemId`, `ItemId` |

- `output=js` (JSON), `Version=20131101`
- `subInfo`에는 `itemPage`만 있고 물리 크기 없음
- 이미지 크기: `coversum` < `cover500` (최대)
