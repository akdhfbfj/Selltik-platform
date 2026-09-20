-- 업무 지시(운영진) · 셀러 문의 통합 게시판
create table if not exists work_items (
  id text primary key,
  type text not null check (type in ('task', 'inquiry')),
  title text not null,
  body text not null,
  author_type text not null check (author_type in ('admin', 'seller')),
  author_name text not null default '',
  shop_id text references shops(id) on delete set null,
  assignee text not null default '',
  status text not null default 'open' check (status in ('open', 'answered', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_work_items_status on work_items(status, created_at desc);
create index if not exists idx_work_items_shop on work_items(shop_id, created_at desc);
alter table work_items enable row level security;

create table if not exists work_item_replies (
  id text primary key,
  work_item_id text not null references work_items(id) on delete cascade,
  author_type text not null check (author_type in ('admin', 'seller')),
  author_name text not null default '',
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_work_item_replies_item
  on work_item_replies(work_item_id, created_at asc);
alter table work_item_replies enable row level security;
