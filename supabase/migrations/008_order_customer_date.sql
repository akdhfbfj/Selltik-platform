-- 주문일(고객 주문) / 발주일(셀틱 전송 묶음) 분리
-- SQL Editor에서 1회 실행

alter table orders
  add column if not exists customer_order_date date;

update orders
set customer_order_date = order_date
where customer_order_date is null;

alter table orders
  alter column customer_order_date set default current_date;

alter table orders
  alter column customer_order_date set not null;

create index if not exists idx_orders_shop_customer_date
  on orders(shop_id, customer_order_date desc);
