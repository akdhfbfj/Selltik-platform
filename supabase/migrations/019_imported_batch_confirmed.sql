-- 발주 묶음 관리자 확인 여부
alter table imported_order_batches
  add column if not exists is_confirmed boolean not null default false;

-- 기존 데이터는 확인된 것으로 처리
update imported_order_batches
  set is_confirmed = true
  where is_confirmed = false;

create index if not exists idx_imported_batches_confirmed_date
  on imported_order_batches (is_confirmed, order_date desc);
