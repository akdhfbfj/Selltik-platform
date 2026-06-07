-- 발주 초안 (3단계: SMS 붙여넣기)
-- SQL Editor에서 1회 실행

create table if not exists orders (
  id text primary key,
  shop_id text not null references shops(id) on delete cascade,
  product_id text references master_products(id) on delete set null,

  order_date date not null default current_date,
  product_name text not null,
  quantity integer not null default 1,

  orderer_name text not null default '',
  recipient_name text not null default '',
  contact_phone text not null default '',
  contact_phone2 text not null default '',

  postal_code text not null default '',
  address text not null default '',
  shipping_memo text not null default '',

  purchase_price integer not null default 0,
  shipping_fee integer not null default 0,
  supply_total integer not null default 0,
  celtic_deposit_amount integer,

  is_remote_area boolean not null default false,
  raw_sms_text text not null default '',
  status text not null default 'draft',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orders_shop_id on orders(shop_id);
create index if not exists idx_orders_shop_date on orders(shop_id, order_date desc);
