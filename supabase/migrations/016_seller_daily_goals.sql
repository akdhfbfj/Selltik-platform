-- 일간 방송 목표

create table if not exists seller_daily_goals (
  shop_id text not null references shops(id) on delete cascade,
  date_key text not null,
  target_revenue integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (shop_id, date_key)
);

create index if not exists idx_seller_daily_goals_shop_date
  on seller_daily_goals(shop_id, date_key desc);
