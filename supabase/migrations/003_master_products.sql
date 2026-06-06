-- 공급가 마스터 + 셀러별 문자 상품명
-- SQL Editor에서 1회 실행

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
