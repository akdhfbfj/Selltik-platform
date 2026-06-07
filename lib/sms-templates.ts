export function getDefaultSmsHeader(shopName: string): string {
  const name = shopName.trim() || "쇼핑몰";
  return `안녕하세요, ${name}입니다 :)`;
}

export function getDefaultSmsFooter(): string {
  return `입금 계좌: OO은행 1234-5678-90 예금주
입금 후 성함·연락처·주소를 문자로 보내주세요.
※ 제주·도서산간은 먼저 성함·연락처·주소를 보내주세요. 배송비 확인 후 입금해 주시면 됩니다.`;
}
