-- 셀러 자기계발 · 방송 기록

create table if not exists marketing_quotes (
  id text primary key,
  body text not null,
  book_title text not null default '',
  author text not null default '',
  category text not null default 'general',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists seller_broadcasts (
  id text primary key,
  shop_id text not null references shops(id) on delete cascade,
  broadcast_date date not null,
  start_time time,
  end_time time,
  revenue integer not null default 0,
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_seller_broadcasts_shop_date
  on seller_broadcasts(shop_id, broadcast_date desc);

create table if not exists seller_monthly_goals (
  shop_id text not null references shops(id) on delete cascade,
  month_key text not null,
  target_revenue integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (shop_id, month_key)
);

insert into marketing_quotes (id, body, book_title, author, category, sort_order)
values
  (
    'mq-001',
    '고객은 제품이 아니라 「변화」를 삽니다. 오늘 방송에서 그 변화를 한 문장으로 말해 보세요.',
    '스토리브랜딩',
    'Donald Miller',
    'opening',
    1
  ),
  (
    'mq-002',
    '가격을 말하기 전에, 이 제품이 해결하는 「고민」을 먼저 공감하세요.',
    'SPIN Selling',
    'Neil Rackham',
    'price',
    2
  ),
  (
    'mq-003',
    '마감은 압박이 아니라 「기회의 마지막 안내」입니다. 남은 수량과 혜택을 명확히.',
    'Influence',
    'Robert Cialdini',
    'closing',
    3
  ),
  (
    'mq-004',
    '한 번 산 고객에게 다시 찾아가는 것이, 새 고객 10명보다 값질 수 있습니다.',
    '리텐션 마케팅',
    '업계 통념',
    'trust',
    4
  ),
  (
    'mq-005',
    '방송 중 침묵을 두려워하지 마세요. 잠깐의 멈춤이 「지금 결정」을 만듭니다.',
    '프레젠테이션의 기술',
    'Nancy Duarte',
    'opening',
    5
  ),
  (
    'mq-006',
    '오늘의 목표는 완벽한 멘트가 아니라, 한 명이라도 「도움이 됐다」고 느끼게 하는 것.',
    '셀틱 셀러 가이드',
    'Selltik',
    'mindset',
    6
  ),
  (
    'mq-007',
    '비교는 경쟁사가 아니라 「어제의 나」와 하세요. 지난 방송보다 10%만 더 명확하게.',
    'Atomic Habits',
    'James Clear',
    'mindset',
    7
  )
on conflict (id) do nothing;
