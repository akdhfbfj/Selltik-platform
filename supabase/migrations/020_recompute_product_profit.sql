-- 기존 상품 마진·마진율 일괄 재계산 (판매가 − 공급가(계) 기준)
update master_products
set
  profit_amount = greatest(0, consumer_price - supply_total),
  profit_rate = case
    when consumer_price > 0 then
      round(
        (greatest(0, consumer_price - supply_total)::numeric / consumer_price) * 100,
        1
      )::text || '%'
    else ''
  end;
