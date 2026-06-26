# 셀틱 플랫폼 프로젝트 가이드

> 신상품·발주 모듈이 붙어 있는 **Next.js + Supabase** 풀스택 프로젝트입니다.  
> 바이브코딩 강의의 [쇼핑몰 PROJECT_GUIDE](../바이브코딩%20스터디/PROJECT_GUIDE.md)와 **사고방식은 같고, 스택·폴더 구조는 다릅니다.**  
> 새 기능 추가·리팩터·온보딩 시 이 문서를 기준으로 하세요.

---

## 목차

1. [플랫폼 한눈에 보기](#1-플랫폼-한눈에-보기)
2. [프로젝트 구조](#2-프로젝트-구조)
3. [기술 스택과 툴 역할](#3-기술-스택과-툴-역할)
4. [로컬 개발 시작 체크리스트](#4-로컬-개발-시작-체크리스트)
5. [개발 서버 실행](#5-개발-서버-실행)
6. [기능 하나 만들 때의 5단계](#6-기능-하나-만들-때의-5단계)
7. [모듈별 페이지·API 맵](#7-모듈별-페이지api-맵)
8. [백엔드 구조: Route / lib / Supabase](#8-백엔드-구조-route--lib--supabase)
9. [인증 (이중 구조)](#9-인증-이중-구조)
10. [프론트엔드 API 연동 패턴](#10-프론트엔드-api-연동-패턴)
11. [파일 업로드 (Supabase Storage)](#11-파일-업로드-supabase-storage)
12. [환경 변수 (.env)](#12-환경-변수-env)
13. [DB 마이그레이션](#13-db-마이그레이션)
14. [배포 단계](#14-배포-단계)
15. [프로젝트 전체 진행 순서 (UX 기준)](#15-프로젝트-전체-진행-순서-ux-기준)
16. [새 기능 추가 체크리스트](#16-새-기능-추가-체크리스트)
17. [점진적 구조 개선 (리팩터 우선순위)](#17-점진적-구조-개선-리팩터-우선순위)
18. [자가 점검 질문](#18-자가-점검-질문)
19. [메모: 막혔던 것 / 다음에 바꿀 것](#19-메모-막혔던-것--다음에-바꿀-것)

---

## 1. 플랫폼 한눈에 보기

```
셀틱 플랫폼 (Selltik)
├── 셀틱 어드민 (ADMIN PIN)     — 업체 컨택, 추천 검토, 발주 통계, 셀러·공급가 관리
├── 셀러 포털 (Supabase Auth)   — 신상품 추천, SMS 발주, 상품 alias, 안내 문자
└── 공개 페이지                 — /recommend (비로그인 추천 제출)
```

| 역할 | 로그인 | 대표 URL |
|------|--------|----------|
| **셀틱 (1~2명)** | `/login` → PIN | `/`, `/inbox`, `/admin/*` |
| **셀러** | `/seller/login` → Supabase | `/seller/*` |
| **셀러 (간편)** | 없음 | `/recommend` (추천만) |

### 데이터 흐름 (개발·배포 공통)

```
[브라우저]
     ↓ React (App Router pages + components)
[Next.js app/api/*]  ← Route Handler
     ↓ lib/*.ts       ← 비즈니스 로직
[Supabase PostgreSQL + Storage]
```

강의 쇼핑몰과의 대응:

| 쇼핑몰 가이드 | 이 프로젝트 |
|---------------|-------------|
| `server/routes/` | `app/api/**/route.ts` |
| `server/controllers/` | `lib/*.ts` (도메인 함수) |
| `server/models/` | `supabase/schema.sql` + `lib/types.ts` |
| `client/src/api/` | *(목표)* `lib/api/*.ts` — 현재는 페이지에서 `fetch` 직접 호출 |
| MongoDB Atlas | Supabase PostgreSQL |
| Heroku + Vercel 분리 | Vercel 단일 배포 |

---

## 2. 프로젝트 구조

```
신상품/                          # repo: Selltik-platform
├── app/
│   ├── page.tsx                 # 셀틱: 업체 컨택 목록 (/)
│   ├── inbox/                   # 셀틱: 셀러 추천함
│   ├── login/                   # 셀틱 PIN 로그인
│   ├── recommend/               # 공개: 신상품 추천 제출
│   ├── admin/                   # 셀틱: 홈, 발주, 셀러, 공급가
│   ├── seller/                  # 셀러 포털
│   └── api/                     # REST API (Route Handlers)
│       ├── auth/                # 셀틱 로그인·로그아웃
│       ├── contacts/            # 업체 컨택 CRUD + 활동 + 제안서
│       ├── recommendations/     # 신상품 추천
│       ├── proposals/           # 업체 제안서 파일
│       ├── admin/               # 셀틱 전용 (shops, products, orders)
│       └── seller/              # 셀러 전용 (orders, products, settings…)
│
├── components/                  # 재사용 UI (ContactCard, SellerNav…)
├── lib/
│   ├── types.ts                 # 공통 타입
│   ├── db.ts                    # contacts, recommendations DB 접근
│   ├── orders.ts, products.ts   # 발주·공급가 도메인
│   ├── proposals.ts             # 업체 제안서
│   ├── auth.ts                  # 셀틱 PIN 세션
│   ├── supabase/                # Supabase 클라이언트 (server / browser / auth)
│   └── upload.ts                # Storage 업로드·삭제
│
├── supabase/
│   ├── schema.sql               # 전체 스키마 (신규 프로젝트용)
│   └── migrations/              # 증분 마이그레이션 (운영 DB에 수동 실행)
├── tests/                       # tsx --test 단위 테스트
├── middleware.ts                # 셀틱·셀러·공개 경로 권한
└── scripts/                     # SQLite 이전 등 일회성 스크립트
```

---

## 3. 기술 스택과 툴 역할

| 툴 | 역할 |
|----|------|
| **Next.js 15 (App Router)** | 페이지 + API를 한 프로젝트에서 처리 |
| **React 19** | UI 컴포넌트 |
| **TypeScript** | 타입 안전 |
| **Tailwind CSS** | 스타일 |
| **Supabase PostgreSQL** | 관계형 DB |
| **Supabase Auth** | 셀러 이메일/비밀번호 로그인 |
| **Supabase Storage** | 이미지·제안서 PDF (`uploads` 버킷) |
| **Vercel** | 프론트 + API 호스팅 |
| **Vitest 대신 `tsx --test`** | `tests/*.test.ts` (SMS 파싱, 가격 계산 등) |

### 개발 vs 배포

| 역할 | 로컬 | 배포 |
|------|------|------|
| 앱 실행 | `npm run dev` → `:3000` | Vercel 자동 빌드 |
| DB | Supabase (동일 프로젝트 또는 dev) | Supabase 프로덕션 |
| 이미지 | Supabase Storage | Supabase Storage |
| 셀틱 로그인 | `ADMIN_PIN` + `SESSION_SECRET` | Vercel Env Vars |
| 셀러 로그인 | Supabase Auth | Supabase Auth |

---

## 4. 로컬 개발 시작 체크리스트

```
□ Supabase 프로젝트 생성 (또는 기존 프로젝트 URL·키 확보)
□ SQL Editor → schema.sql (최초) 또는 migrations/*.sql (증분) 실행
□ Storage → 버킷 uploads → Public bucket
□ .env 파일 작성 (아래 12장 참고)
□ npm install
□ npm run dev
□ http://localhost:3000/login — 셀틱 PIN 로그인 확인
□ http://localhost:3000/seller/login — 셀러 로그인 확인
□ http://localhost:3000/recommend — 공개 추천 폼 확인
```

---

## 5. 개발 서버 실행

쇼핑몰 가이드와 달리 **터미널 1개**면 됩니다.

| 명령 | 역할 | 포트 |
|------|------|------|
| `npm run dev` | Next.js dev (HMR + API) | 3000 |
| `npm run build` | 프로덕션 빌드 검증 | — |
| `npm test` | 단위 테스트 | — |

### 재시작이 필요한 경우

| 상황 | 조치 |
|------|------|
| `.env` 수정 | Ctrl+C → `npm run dev` 재실행 |
| `npm install` 후 | 재시작 |
| Supabase SQL 마이그레이션 실행 후 | 재시작 불필요 (앱만 새로고침) |
| API 500 + "Supabase 환경변수" | `.env` 확인 후 재시작 |

---

## 6. 기능 하나 만들 때의 5단계

쇼핑몰 가이드와 **동일한 순서**, 파일 위치만 다릅니다.

```
1. 스키마(테이블)      → supabase/migrations/NNN_xxx.sql (+ schema.sql 반영)
2. 타입 + lib 로직     → lib/types.ts, lib/xxx.ts
3. API Route           → app/api/.../route.ts  (lib 호출만, 얇게)
4. UI                  → app/.../page.tsx + components/
5. 테스트              → tests/ + 브라우저 수동 확인
```

### 백엔드 파일 추가 순서 (2~3번 상세)

```
supabase/migrations/011_xxx.sql
  ↓
lib/types.ts (인터페이스)
  ↓
lib/xxx.ts (createXxx, getXxx, …)
  ↓
app/api/xxx/route.ts
  ↓
middleware.ts — 새 경로가 public / seller / admin 중 어디인지 확인
```

### 프론트 파일 추가 순서 (4번 상세)

```
app/xxx/page.tsx (또는 components/Xxx.tsx)
  ↓
lib/api/xxx.ts  ← (권장) apiClient 사용
  ↓
AdminNav / SellerNav 에 링크 추가 (필요 시)
```

**규칙**: Route Handler 안에 SQL·복잡한 로직을 길게 쓰지 않고 `lib/`로 내립니다.

---

## 7. 모듈별 페이지·API 맵

### 7-1. 신상품 모듈

| 페이지 | 설명 |
|--------|------|
| `/recommend` | 공개 추천 제출 |
| `/seller/recommend` | 셀러 로그인 후 추천 |
| `/inbox` | 셀틱: 추천 검토 → 컨택 전환 |
| `/` | 셀틱: 업체 컨택 CRUD |

| API | 메서드 | 설명 |
|-----|--------|------|
| `/api/recommendations` | GET, POST | 추천 목록·등록 |
| `/api/recommendations/[id]` | GET, PUT, DELETE | 추천 상세 |
| `/api/recommendations/[id]/images` | POST | 추천 이미지 |
| `/api/contacts` | GET, POST | 업체 목록·등록 |
| `/api/contacts/[id]` | GET, PUT, DELETE | 업체 CRUD |
| `/api/contacts/[id]/images` | POST, DELETE | 업체 이미지 |
| `/api/contacts/[id]/activities` | GET, POST | 활동 기록 |
| `/api/contacts/[id]/activities/[activityId]` | DELETE | 활동 삭제 |
| `/api/contacts/check-duplicate` | POST | 중복 검사 |
| `/api/contacts/[id]/proposals` | GET, POST | 업체 제안서 |
| `/api/proposals/[id]` | GET, PUT, DELETE | 제안서 CRUD |
| `/api/proposals/[id]/download` | GET | 제안서 다운로드 |
| `/api/seller/recommendations` | GET, POST | 셀러 추천 |
| `/api/seller/recommendations/[id]` | GET, PUT, DELETE | 셀러 추천 상세 |

**관련 lib**: `lib/db.ts`, `lib/proposals.ts`, `lib/upload.ts`, `lib/types.ts`

**관련 테이블**: `recommendations`, `contacts`, `contact_activities`, `vendor_proposals`, `curated_items`

---

### 7-2. 발주 모듈

| 페이지 | 설명 |
|--------|------|
| `/seller/orders` | SMS 답장·발주 초안·확정 |
| `/seller/orders/import` | SMS 일괄 가져오기 |
| `/seller/outbound-sms` | 안내 문자 템플릿 |
| `/admin/orders` | 셀틱: 전체 발주 현황 |

| API | 메서드 | 설명 |
|-----|--------|------|
| `/api/seller/orders` | GET, POST | 발주 목록·생성 |
| `/api/seller/orders/[id]` | GET, PUT, DELETE | 발주 상세 |
| `/api/seller/orders/[id]/status` | PATCH | 상태 변경 |
| `/api/seller/orders/bulk-status` | POST | 일괄 상태 |
| `/api/seller/orders/bulk-create` | POST | 일괄 생성 |
| `/api/seller/orders/parse` | POST | SMS 1건 파싱 |
| `/api/seller/orders/parse-batch` | POST | SMS 일괄 파싱 |
| `/api/seller/orders/resolve-address` | POST | 카카오 주소 보정 |
| `/api/seller/orders/export` | GET | 엑셀 export |
| `/api/admin/orders` | GET | 어드민 발주 목록 |
| `/api/admin/orders/stats` | GET | 월별 통계 |

**관련 lib**: `lib/orders.ts`, `lib/parse-order-sms.ts`, `lib/order-pricing.ts`, `lib/export-order-xlsx.ts`, `lib/kakao-address.ts`, `lib/sms-templates.ts`

**관련 테이블**: `orders`, `master_products`, `seller_product_aliases`, `seller_product_reviews`

---

### 7-3. 셀러·공급가 (어드민)

| 페이지 | 설명 |
|--------|------|
| `/admin` | 셀틱 대시보드 |
| `/admin/shops` | 셀러(shop) 계정 |
| `/admin/products` | 공급가 마스터·CSV import |
| `/seller/products` | 셀러 상품 alias·검토 알림 |
| `/seller/account` | 셀러 계정 정보 |

| API | 메서드 | 설명 |
|-----|--------|------|
| `/api/admin/shops` | GET, POST | 셀러 목록·생성 |
| `/api/admin/shops/[id]` | GET, PUT, DELETE | 셀러 CRUD |
| `/api/admin/products` | GET, POST | 마스터 상품 |
| `/api/admin/products/[id]` | GET, PUT, DELETE | 상품 CRUD |
| `/api/admin/products/import` | POST | CSV import |
| `/api/seller/products` | GET, PUT | 셀러 상품 뷰 |
| `/api/seller/products/acknowledge` | POST | 가격 변경 확인 |
| `/api/seller/settings` | GET, PUT | SMS 헤더/푸터 |
| `/api/seller/me` | GET | 현재 셀러 shop 정보 |

**관련 lib**: `lib/shops.ts`, `lib/seller.ts`, `lib/products.ts`, `lib/parse-supply-csv.ts`

**관련 테이블**: `shops`, `master_products`, `seller_product_aliases`, `seller_product_reviews`

---

### 7-4. 인증

| API | 메서드 | 설명 |
|-----|--------|------|
| `/api/auth/login` | POST | 셀틱 PIN → `admin_session` 쿠키 |
| `/api/auth/logout` | POST | 셀틱 세션 삭제 |

셀러는 Supabase Auth (클라이언트 `signInWithPassword`) — 별도 API Route 없음.

---

## 8. 백엔드 구조: Route / lib / Supabase

### 실행 흐름

```
middleware.ts       ← 경로별 권한 (셀틱 PIN / 셀러 Supabase / public)
  ↓
app/api/.../route.ts   ← HTTP 메서드, 입력 검증, JSON 응답 (Router 역할)
  ↓
lib/xxx.ts             ← 비즈니스 로직 (Controller 역할)
  ↓
createServerClient()   ← service_role로 DB/Storage (Model 접근)
  ↓
Supabase PostgreSQL
```

### 좋은 Route Handler 예시

```ts
// app/api/contacts/route.ts — 얇게 유지
import { createContact, getAllContacts, getStats } from "@/lib/db";

export async function GET() {
  const contacts = await getAllContacts();
  const stats = await getStats();
  return NextResponse.json({ contacts, stats });
}
```

### lib 역할 분리 (현재 → 권장)

| lib 파일 | 역할 |
|----------|------|
| `lib/db.ts` | contacts, recommendations, activities |
| `lib/orders.ts` | 발주 CRUD·검색 |
| `lib/products.ts` | 마스터 상품·alias·검토 플래그 |
| `lib/proposals.ts` | 제안서·curated_items |
| `lib/shops.ts`, `lib/seller.ts` | shop·셀러 세션 |
| `lib/parse-order-sms.ts` 등 | 순수 함수 (DB 없음) |

나중에 `lib/`가 더 커지면 `lib/domains/contacts.ts` 식으로 묶어도 됩니다. **한 번에 옮기지 말고**, 손대는 파일부터 이동.

---

## 9. 인증 (이중 구조)

이 프로젝트만의 특징: **셀틱과 셀러가 다른 인증**을 씁니다.

### 셀틱 (어드민)

```
[로그인]  PIN 입력 → /api/auth/login
[저장]    admin_session 쿠키 = SESSION_SECRET 값
[검사]    middleware + lib/auth.ts → isAuthenticated()
[보호]    /, /inbox, /admin/*, /api/admin/*, 대부분 /api/*
```

### 셀러

```
[로그인]  /seller/login → Supabase signInWithPassword
[저장]    Supabase SSR 쿠키 (자동)
[검사]    middleware → supabase.auth.getUser()
[보호]    /seller/*, /api/seller/*
```

### 공개 (로그인 불필요)

- 페이지: `/recommend`, `/login`, `/seller/login`
- API: `POST /api/recommendations`, `POST /api/recommendations/[id]/images`, `POST /api/auth/login`

### 이중 방어 원칙 (쇼핑몰 가이드와 동일)

- **UI만** 막고 API는 열어두지 않는다.
- 새 admin API → `middleware.ts`의 `isAdminApi` 경로에 포함되는지 확인.
- 새 seller API → `/api/seller/` 아래 두면 middleware가 자동 보호.

---

## 10. 프론트엔드 API 연동 패턴

### 현재 상태

대부분 페이지에서 **`fetch("/api/...")` 직접 호출** (예: `app/page.tsx`, `app/seller/orders/page.tsx`).

### 목표 패턴 (새 코드·리팩터 시)

```
lib/api/client.ts     ← 공통 fetch, 에러 메시지, JSON 파싱
lib/api/contacts.ts   ← getContacts(), createContact(), …
lib/api/orders.ts
```

**규칙**: 페이지·컴포넌트에서 `fetch` 직접 쓰지 않고 `lib/api/*`를 통한다.

### apiClient 스켈레톤 (추가 예정)

```ts
// lib/api/client.ts
export async function apiClient<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `요청 실패 (${res.status})`);
  }
  return res.json() as Promise<T>;
}
```

기존 페이지는 **수정할 때마다** 위 패턴으로 옮깁니다. 한 번에 전면 교체하지 않습니다.

---

## 11. 파일 업로드 (Supabase Storage)

| 용도 | lib 함수 | Storage 경로 |
|------|----------|--------------|
| 업체·추천 이미지 | `saveUploadedFile()` | `uploads/` |
| 업체 제안서 PDF | `saveProposalFile()` | `uploads/proposals/` |

- 버킷 이름: `uploads` (Public)
- DB에는 **URL 또는 storage path**만 저장 (`lib/upload.ts` 참고)
- 삭제 시 Storage + DB row 함께 정리 (`deleteUploadedFile`, `deleteStorageFile`)

---

## 12. 환경 변수 (.env)

| 변수 | 필수 | 설명 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | anon key (브라우저·middleware) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | 서버 전용 (**비밀**, lib DB 접근) |
| `ADMIN_PIN` | ✅ | 셀틱 로그인 PIN (**비밀**) |
| `SESSION_SECRET` | ✅ | admin_session 쿠키 값 (**비밀**) |
| `KAKAO_REST_API_KEY` | 선택 | 주소 보정 (`resolve-address`) |

- `NEXT_PUBLIC_*` → 브라우저에 노출됨. **service_role·PIN·SESSION_SECRET은 절대 NEXT_PUBLIC 붙이지 않음.**
- Vercel: Project Settings → Environment Variables에 동일하게 등록.

---

## 13. DB 마이그레이션

운영 Supabase에는 **SQL Editor에서 migrations 파일을 순서대로** 실행합니다.

| 파일 | 내용 |
|------|------|
| `002_shops_auth.sql` | shops, Supabase Auth 연동 |
| `003_master_products.sql` | 공급가 마스터 |
| `004_seller_product_reviews.sql` | 가격 변경 검토 |
| `005_orders.sql` | 발주 테이블 |
| `006_shop_sms_templates.sql` | SMS 템플릿 |
| `007_sms_parse_samples.sql` | SMS 학습 샘플 |
| `008_order_customer_date.sql` | 발주 날짜 필드 |
| `009_seller_review_reason.sql` | 검토 사유 |
| `010_vendor_proposals.sql` | 제안서 + curated_items |
| `add_desired_price.sql` | 추천 희망가 |

**규칙**

1. 새 테이블/컬럼 → `supabase/migrations/NNN_설명.sql` 추가
2. `supabase/schema.sql`에도 반영 (신규 설치용 전체 스키마 유지)
3. 배포 전 Supabase SQL Editor 실행 여부를 커밋 메시지·PR에 명시

---

## 14. 배포 단계

```
1. git push → GitHub (main)
2. Vercel 자동 배포 → https://selltik-platform.vercel.app
3. Vercel Env Vars 확인
4. 새 migration 있으면 Supabase SQL Editor 실행
5. Storage 버킷 uploads 존재·Public 확인
```

### 배포 후 확인

| URL | 확인 내용 |
|-----|-----------|
| `/login` | 셀틱 PIN 로그인 |
| `/` | 업체 컨택 목록 |
| `/seller/login` | 셀러 로그인 |
| `/recommend` | 공개 추천 |

---

## 15. 프로젝트 전체 진행 순서 (UX 기준)

**이미 만든 것**은 다시 만들지 않고, **미완·정리**만 이 순서로 진행합니다.

| 순서 | 기능 | 상태 | 다음 할 일 |
|------|------|------|------------|
| 1 | 셀틱 PIN 로그인 | ✅ | — |
| 2 | 신상품 추천 (공개·셀러) | ✅ | — |
| 3 | 추천함 → 업체 컨택 전환 | ✅ | — |
| 4 | 업체 컨택 CRUD + 활동 | ✅ | — |
| 5 | 업체 제안서·curated_items | 🔄 진행 중 | UI·다운로드·셀러 공유 흐름 마무리 |
| 6 | 셀러 Supabase 로그인 + shops | ✅ | — |
| 7 | 공급가 마스터 + CSV | ✅ | — |
| 8 | SMS 발주 파싱·초안 | ✅ | — |
| 9 | 발주 확정·엑셀 export | ✅ | — |
| 10 | 어드민 발주 통계 | ✅ | — |
| 11 | **구조 정리** | ⬜ | lib/api 레이어, PROJECT_GUIDE 유지 |
| 12 | 정산 모듈 | ⬜ | 로드맵 |

---

## 16. 새 기능 추가 체크리스트

예: "curated_items 셀러 공유" 추가

### DB·백엔드

```
□ supabase/migrations/011_xxx.sql
□ schema.sql 반영
□ lib/types.ts 타입 추가
□ lib/xxx.ts 비즈니스 로직
□ app/api/.../route.ts
□ middleware.ts — public/seller/admin 분류 확인
□ npm test (해당 도메인 테스트 있으면 추가)
```

### 프론트

```
□ lib/api/xxx.ts (권장)
□ components/ 또는 app/.../page.tsx
□ AdminNav / SellerNav 링크
□ 브라우저 + API 직접 호출 테스트
```

### 배포

```
□ git commit & push
□ Supabase migration 실행 (있으면)
□ Vercel 배포 확인
```

---

## 17. 점진적 구조 개선 (리팩터 우선순위)

**처음부터 다시 만들지 않습니다.** 아래는 손댈 때마다 조금씩.

| 우선순위 | 대상 | 이유 |
|----------|------|------|
| 1 | 새 기능은 5단계 + lib/api 패턴 | 점진적으로 표준 확립 |
| 2 | Route Handler 두꺼운 파일 | lib로 로직 이동 |
| 3 | 페이지 inline fetch | lib/api로 추출 |
| 4 | README ↔ 실제 기능 | onboarding 혼란 방지 |
| 5 | lib/ 폴더 도메인별 분리 | 파일 수 증가 시 |

---

## 18. 자가 점검 질문

1. **새 REST API를 추가하려면 어디를 건드리나?**  
   → migration, `lib/`, `app/api/`, (프론트) `lib/api/`, `middleware.ts`

2. **셀틱만 접근하게 하려면?**  
   → `/api/admin/*` 또는 PIN 보호 `/api/*`, middleware 확인

3. **셀러만 접근하게 하려면?**  
   → `/api/seller/*` + Supabase 로그인 (middleware)

4. **공개 API로 열어도 되나?**  
   → `middleware.ts`의 `isPublicApi`에 명시적으로 추가

5. **DB 스키마 바꾼 뒤?**  
   → Supabase SQL Editor 실행 + schema.sql 동기화

6. **로컬에서 API 500 (Supabase)?**  
   → `.env`의 URL·service_role 확인, dev 서버 재시작

---

## 19. 메모: 막혔던 것 / 다음에 바꿀 것

> 직접 채워 가며 복기하세요.

### 막혔던 것 & 해결

| 문제 | 원인 | 해결 |
|------|------|------|
| | | |

### 다음에 바꿔볼 것

- [ ] `lib/api/client.ts` 도입 후 페이지 fetch 점진 이전
- [ ] React Query 등 서버 상태 관리 (선택)
- [ ] 셀틱 PIN → Supabase Auth 통합 검토 (장기)
- [ ] 기타:

---

*마지막 업데이트: 2026-06-27 — 신상품(Selltik) 코드베이스 기준*
