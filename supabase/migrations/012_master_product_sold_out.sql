-- 공급가 마스터 품절 상태
alter table master_products
  add column if not exists is_sold_out boolean not null default false;

create index if not exists idx_master_products_sold_out
  on master_products(is_sold_out)
  where is_sold_out = true;
