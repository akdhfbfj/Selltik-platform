// Chrome의 PWA 설치 조건(설치 가능 여부 판단) 충족용 서비스워커.
// 의도적으로 아무것도 캐싱하지 않는다 — 이 앱은 데이터가 자주 바뀌므로
// fetch를 가로채 오래된 응답을 돌려주면 오히려 문제가 된다.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // 응답을 가로채지 않음 — 브라우저 기본 네트워크 요청 그대로 통과.
});
