import test from "node:test";
import assert from "node:assert/strict";
import {
  decodeXmlEntities,
  filterSmsBackupMessages,
  looksLikeOrderSms,
  parseSmsBackupXml,
  smsDateToIso,
} from "../lib/sms-backup-xml";

const SAMPLE_XML = `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>
<smses count="3" backup_date="20240606.120000">
  <sms protocol="0" address="01012345678" date="1717639200000" type="1" body="쉬젤 팬 x1&#10;받는분 홍길동&#10;010-1111-2222&#10;서울 강남구 테헤란로 1" readable_date="Jun 6, 2024 10:00:00 AM" />
  <sms protocol="0" address="15881234" date="1717639200000" type="1" body="[Web발신] 입금 확인되었습니다" readable_date="Jun 6, 2024 10:05:00 AM" />
  <sms protocol="0" address="01099998888" date="1717639200000" type="2" body="안내 문자입니다. 주소 보내주세요" readable_date="Jun 6, 2024 09:00:00 AM" />
</smses>`;

test("decodeXmlEntities: 줄바꿈·특수문자", () => {
  assert.equal(decodeXmlEntities("a&#10;b&amp;c"), "a\nb&c");
});

test("parseSmsBackupXml: SMS 추출·정렬", () => {
  const result = parseSmsBackupXml(SAMPLE_XML);
  assert.equal(result.smsCount, 3);
  assert.equal(result.mmsCount, 0);
  assert.equal(result.backupDate, "20240606.120000");
  assert.equal(result.messages.length, 3);
  assert.ok(result.messages[0].body.includes("홍길동"));
});

test("looksLikeOrderSms: 주문 형태 판별", () => {
  const orderBody =
    "쉬젤 팬 x1\n받는분 홍길동\n010-1111-2222\n서울 강남구 테헤란로 1";
  assert.equal(looksLikeOrderSms(orderBody), true);
  assert.equal(looksLikeOrderSms("[Web발신] 입금 확인되었습니다"), false);
});

test("filterSmsBackupMessages: 수신·주문형태·기간", () => {
  const { messages } = parseSmsBackupXml(SAMPLE_XML);
  const dateIso = smsDateToIso(1717639200000);

  const received = filterSmsBackupMessages(messages, { receivedOnly: true });
  assert.equal(received.length, 2);

  const orderLike = filterSmsBackupMessages(messages, {
    receivedOnly: true,
    orderLikeOnly: true,
  });
  assert.equal(orderLike.length, 1);
  assert.ok(orderLike[0].body.includes("홍길동"));

  const inRange = filterSmsBackupMessages(messages, {
    dateFrom: dateIso,
    dateTo: dateIso,
  });
  assert.equal(inRange.length, 3);

  const empty = filterSmsBackupMessages(messages, {
    dateFrom: "2099-01-01",
    dateTo: "2099-12-31",
  });
  assert.equal(empty.length, 0);
});
