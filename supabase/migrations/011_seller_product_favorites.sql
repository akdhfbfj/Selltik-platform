-- 셀러별 인기 상품 (즐겨찾기)
create table if not exists seller_product_favorites (
  id text primary key,
  shop_id text not null references shops(id) on delete cascade,
  product_id text not null references master_products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (shop_id, product_id)
);

create index if not exists idx_favorites_shop on seller_product_favorites(shop_id, created_at desc);
