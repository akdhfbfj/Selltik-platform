-- 같은 날 여러 번 내려받은 최종 발주서 파일 구분 (A, B, C…)
alter table orders
  add column if not exists export_suffix text;
