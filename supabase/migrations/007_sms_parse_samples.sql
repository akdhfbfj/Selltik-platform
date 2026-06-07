-- 문자 파싱 학습용: 자동 파싱 vs 셀러 최종값
create table if not exists sms_parse_samples (
  id text primary key,
  shop_id text not null references shops(id) on delete cascade,
  order_id text references orders(id) on delete set null,
  raw_sms_text text not null,
  auto_parsed jsonb not null,
  seller_final jsonb not null,
  corrected_fields text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_sms_parse_samples_shop on sms_parse_samples(shop_id, created_at desc);
