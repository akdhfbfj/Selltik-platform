-- 셀틱 원가 (매입가관리 CSV)
alter table master_products
  add column if not exists celtic_purchase_price integer not null default 0,
  add column if not exists celtic_base_shipping integer not null default 0,
  add column if not exists celtic_supply_total integer not null default 0;

-- 과거 발주 CSV 묶음 집계 (행 단위 저장 없음)
create table if not exists imported_order_batches (
  id text primary key,
  shop_id text references shops(id) on delete set null,
  seller_name text not null default '',
  order_date date not null,
  batch_title text not null default '',
  line_count integer not null default 0,
  unmatched_lines integer not null default 0,
  celtic_deposit_total integer not null default 0,
  deposit_amount integer,
  seller_sales_total integer not null default 0,
  seller_margin_total integer not null default 0,
  celtic_cost_total integer not null default 0,
  celtic_margin_total integer not null default 0,
  import_key text not null unique,
  source_file_name text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_imported_batches_date
  on imported_order_batches (order_date desc);

create index if not exists idx_imported_batches_shop_date
  on imported_order_batches (shop_id, order_date desc);
