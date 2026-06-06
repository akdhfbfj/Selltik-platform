-- 셀틱 플랫폼 (신상품 + 추후 발주 모듈)
-- Supabase SQL Editor에서 실행하세요.

create extension if not exists "pgcrypto";

-- ── 미래 발주/셀러용 (방 추가) ──
create table if not exists shops (
  id text primary key,
  name text not null,
  contact_email text not null default '',
  auth_user_id uuid unique,
  plan text not null default 'free',
  created_at timestamptz not null default now()
);

create index if not exists idx_shops_auth_user_id on shops(auth_user_id);

-- ── 공급가 마스터 (발주 모듈) ──
create table if not exists master_products (
  id text primary key,
  official_name text not null unique,
  description text not null default '',
  purchase_price integer not null default 0,
  base_shipping integer not null default 0,
  supply_total integer not null default 0,
  consumer_price integer not null default 0,
  profit_amount integer not null default 0,
  profit_rate text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists seller_product_aliases (
  id text primary key,
  shop_id text not null references shops(id) on delete cascade,
  product_id text not null references master_products(id) on delete cascade,
  sms_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, product_id)
);

create index if not exists idx_master_products_sort on master_products(sort_order);
create index if not exists idx_aliases_shop_id on seller_product_aliases(shop_id);

-- ── 셀러 신상품 추천 ──
create table if not exists recommendations (
  id text primary key,
  product_name text not null,
  brand text not null default '',
  reason text not null default '',
  reference_url text not null default '',
  desired_price text not null default '',
  seller_name text not null,
  shop_id text references shops(id) on delete set null,
  status text not null default 'new',
  images jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── 셀틱 업체 컨택 ──
create table if not exists contacts (
  id text primary key,
  company_name text not null,
  contact_person text not null default '',
  phone text not null default '',
  email text not null default '',
  website text not null default '',
  address text not null default '',
  product_info text not null default '',
  notes text not null default '',
  status text not null default 'new',
  tags text not null default '',
  uploaded_by text not null default '',
  recommendation_id text references recommendations(id) on delete set null,
  images jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── 업체 활동 기록 ──
create table if not exists contact_activities (
  id text primary key,
  contact_id text not null references contacts(id) on delete cascade,
  content text not null,
  author text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_contacts_updated_at on contacts(updated_at desc);
create index if not exists idx_recommendations_created_at on recommendations(created_at desc);
create index if not exists idx_activities_contact_id on contact_activities(contact_id, created_at desc);

-- Storage: Dashboard > Storage > New bucket > name: uploads > Public bucket
