# 신상품 관리 도구 (셀틱 플랫폼 · 신상품 모듈)

셀러는 상품만 추천하고, 셀틱(1~2명)이 업체 컨택을 진행하는 도구입니다.  
Supabase + Vercel 기반이며, 추후 발주·정산 모듈을 같은 플랫폼에 추가할 수 있습니다.

## 페이지 구성

| 주소 | 누가 쓰나 | 하는 일 |
|------|-----------|---------|
| `/recommend` | 셀러 | 신상품 추천만 제출 (연락처 접근 불가) |
| `/login` | 셀틱 | 관리 페이지 로그인 |
| `/inbox` | 셀틱 | 셀러 추천 검토 → 업체 컨택으로 전환 |
| `/` | 셀틱 | 업체 연락처 등록·상태 관리 |

## Supabase 설정 (최초 1회)

1. [supabase.com](https://supabase.com)에서 프로젝트 생성
2. **SQL Editor** → `supabase/schema.sql` 내용 실행
3. **Storage** → New bucket → 이름 `uploads` → **Public bucket** 체크
4. **Project Settings → API**에서 URL, anon key, service_role key 복사

## 로컬 실행

```bash
npm install
cp .env.example .env   # Supabase 키 + 비밀번호 입력
npm run dev
```

- 셀러 추천: http://localhost:3000/recommend
- 셀틱 관리: http://localhost:3000/login (`ADMIN_PIN` 환경변수로 설정)

## Vercel 배포

1. GitHub에 푸시 후 [vercel.com](https://vercel.com)에서 Import
2. Environment Variables에 `.env.example` 항목 모두 등록
3. Deploy

배포 후 셀러에게 `https://your-app.vercel.app/recommend` 링크 공유

## 기존 SQLite 데이터 이전 (선택)

PC에 `data/contacts.db`가 있으면:

```bash
node scripts/migrate-sqlite.mjs
```

로컬 이미지(`public/uploads/`)는 Supabase Storage로 자동 업로드됩니다.

## 데이터 저장

- DB: Supabase PostgreSQL
- 이미지: Supabase Storage (`uploads` 버킷)

## 플랫폼 구조 (로드맵)

```
셀틱 플랫폼
├── shops (셀러/쇼핑몰 — 추후)
├── 신상품 모듈 ← 현재
│   ├── recommendations
│   └── contacts + activities
└── 발주 모듈 (추후)
```
