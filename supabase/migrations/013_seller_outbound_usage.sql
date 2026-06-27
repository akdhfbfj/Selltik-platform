-- 셀러별 안내 문자 최근 사용 상품 (검색 상단 노출용)
create table if not exists seller_outbound_usage (
  id text primary key,
  shop_id text not null references shops(id) on delete cascade,
  product_id text not null references master_products(id) on delete cascade,
  last_used_at timestamptz not null default now(),
  unique (shop_id, product_id)
);

create index if not exists idx_outbound_usage_shop_recent
  on seller_outbound_usage(shop_id, last_used_at desc);
