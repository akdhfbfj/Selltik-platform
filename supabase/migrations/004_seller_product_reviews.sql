-- 셀러별 상품 변경 확인 (CSV/관리자 수정 시)
-- SQL Editor에서 1회 실행

create table if not exists seller_product_reviews (
  id text primary key,
  shop_id text not null references shops(id) on delete cascade,
  product_id text not null references master_products(id) on delete cascade,
  needs_review boolean not null default true,
  flagged_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  unique (shop_id, product_id)
);

create index if not exists idx_reviews_shop_pending
  on seller_product_reviews(shop_id)
  where needs_review = true;
