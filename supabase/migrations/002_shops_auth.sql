-- 셀러 로그인 (Supabase Auth 연동)
-- SQL Editor에서 1회 실행

alter table shops
  add column if not exists auth_user_id uuid unique,
  add column if not exists contact_email text not null default '';

create index if not exists idx_shops_auth_user_id on shops(auth_user_id);
