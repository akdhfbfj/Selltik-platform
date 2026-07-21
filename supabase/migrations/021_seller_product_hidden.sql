-- 셀러별 상품 숨김 (안 파는 상품)
create table if not exists seller_product_hidden (
  id text primary key,
  shop_id text not null references shops(id) on delete cascade,
  product_id text not null references master_products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (shop_id, product_id)
);

create index if not exists idx_hidden_shop on seller_product_hidden(shop_id, created_at desc);
