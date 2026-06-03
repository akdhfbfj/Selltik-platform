-- 이미 만든 Supabase DB에 희망 판매가격 컬럼 추가 (SQL Editor에서 1회 실행)
alter table recommendations
  add column if not exists desired_price text not null default '';
