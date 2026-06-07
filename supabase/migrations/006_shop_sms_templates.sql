-- 셀러 안내 문자 상단·하단 문구
-- SQL Editor에서 1회 실행

alter table shops
  add column if not exists sms_header text not null default '',
  add column if not exists sms_footer text not null default '';
