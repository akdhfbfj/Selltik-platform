-- 관리자 발주 현황에서만 숨김 (셀러 데이터는 유지)
alter table orders
  add column if not exists hidden_from_admin boolean not null default false;

create index if not exists idx_orders_admin_visible
  on orders (order_date desc)
  where hidden_from_admin = false;
