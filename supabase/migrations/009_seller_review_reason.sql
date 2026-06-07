-- 셀러 상품 확인 사유·변경 내역
alter table seller_product_reviews
  add column if not exists review_reason text not null default 'price_change',
  add column if not exists change_detail jsonb;
