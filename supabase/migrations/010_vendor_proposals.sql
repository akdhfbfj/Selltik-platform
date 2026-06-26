-- 업체 제안서 아카이브 + 선별 상품
-- SQL Editor에서 1회 실행

create table if not exists vendor_proposals (
  id text primary key,
  contact_id text not null references contacts(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists curated_items (
  id text primary key,
  proposal_id text not null references vendor_proposals(id) on delete cascade,
  contact_id text not null references contacts(id) on delete cascade,
  product_name text not null,
  image_url text not null default '',
  detail_image_url text not null default '',
  celtic_purchase integer not null default 0,
  seller_supply integer not null default 0,
  tiktok_price integer not null default 0,
  admin_note text not null default '',
  status text not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_vendor_proposals_contact on vendor_proposals(contact_id, created_at desc);
create index if not exists idx_curated_items_proposal on curated_items(proposal_id, sort_order);
create index if not exists idx_curated_items_contact on curated_items(contact_id, status);
