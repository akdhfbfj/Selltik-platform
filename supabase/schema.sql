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
  sms_header text not null default '',
  sms_footer text not null default '',
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
  is_sold_out boolean not null default false,
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

create table if not exists seller_product_favorites (
  id text primary key,
  shop_id text not null references shops(id) on delete cascade,
  product_id text not null references master_products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (shop_id, product_id)
);

create index if not exists idx_favorites_shop on seller_product_favorites(shop_id, created_at desc);

create table if not exists seller_outbound_usage (
  id text primary key,
  shop_id text not null references shops(id) on delete cascade,
  product_id text not null references master_products(id) on delete cascade,
  last_used_at timestamptz not null default now(),
  unique (shop_id, product_id)
);

create index if not exists idx_outbound_usage_shop_recent
  on seller_outbound_usage(shop_id, last_used_at desc);

create table if not exists seller_product_reviews (
  id text primary key,
  shop_id text not null references shops(id) on delete cascade,
  product_id text not null references master_products(id) on delete cascade,
  needs_review boolean not null default true,
  flagged_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  review_reason text not null default 'price_change',
  change_detail jsonb,
  unique (shop_id, product_id)
);

create index if not exists idx_reviews_shop_pending
  on seller_product_reviews(shop_id)
  where needs_review = true;

-- ── 발주 초안 (3단계) ──
create table if not exists orders (
  id text primary key,
  shop_id text not null references shops(id) on delete cascade,
  product_id text references master_products(id) on delete set null,

  order_date date not null default current_date,
  product_name text not null,
  quantity integer not null default 1,

  orderer_name text not null default '',
  recipient_name text not null default '',
  contact_phone text not null default '',
  contact_phone2 text not null default '',

  postal_code text not null default '',
  address text not null default '',
  shipping_memo text not null default '',

  purchase_price integer not null default 0,
  shipping_fee integer not null default 0,
  supply_total integer not null default 0,
  celtic_deposit_amount integer,

  is_remote_area boolean not null default false,
  raw_sms_text text not null default '',
  status text not null default 'draft',
  export_suffix text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orders_shop_id on orders(shop_id);
create index if not exists idx_orders_shop_date on orders(shop_id, order_date desc);

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

-- ── 업체 제안서 아카이브 + 선별 상품 ──
create table if not exists vendor_proposals (
  id text primary key,
  contact_id text not null references contacts(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists curated_items (
  id text primary key,
  proposal_id text not null references vendor_proposals(id) on delete cascade,
  contact_id text not null references contacts(id) on delete cascade,
  product_name text not null,
  image_url text not null default '',
  detail_image_url text not null default '',
  celtic_purchase integer not null default 0,
  seller_supply integer not null default 0,
  tiktok_price integer not null default 0,
  admin_note text not null default '',
  status text not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_vendor_proposals_contact on vendor_proposals(contact_id, created_at desc);
create index if not exists idx_curated_items_proposal on curated_items(proposal_id, sort_order);
create index if not exists idx_curated_items_contact on curated_items(contact_id, status);

-- Storage: Dashboard > Storage > New bucket > name: uploads > Public bucket
