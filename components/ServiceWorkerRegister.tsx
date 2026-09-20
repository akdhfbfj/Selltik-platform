"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // 설치 배너가 안 뜨는 것 외엔 영향 없음 — 조용히 무시
      });
    }
  }, []);

  return null;
}
