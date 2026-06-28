"use client";

import {
  extractDetailAddress,
  formatSelectedPostcodeAddress,
  type PostcodeSelection,
} from "@/lib/extract-detail-address";
import { Loader2, MapPin } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/** 공식 가이드: t1.kakaocdn.net (구 daumcdn은 동작 불안정) */
export const KAKAO_POSTCODE_SCRIPT =
  "https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

export interface PostcodePickResult {
  postalCode: string;
  address: string;
  detailAddress: string;
}

interface KakaoPostcodePickerProps {
  rawAddress: string;
  onPick: (result: PostcodePickResult) => void;
  onStatus?: (message: string) => void;
  inputSlot: ReactNode;
  /** 검색 버튼 문구 */
  searchButtonLabel?: string;
  /** 값이 바뀔 때마다 검색창 자동 오픈 (분석 직후 등) */
  autoOpenTrigger?: number;
  /** 증가할 때 열려 있는 검색창 닫기 */
  closeSignal?: number;
  /** 검색 버튼을 입력란 아래에 배치 */
  searchButtonBelow?: boolean;
}

type PostcodeCtor = new (options: {
  oncomplete: (data: PostcodeSelection) => void;
  onresize?: (size: { height: number }) => void;
  hideMapBtn?: boolean;
  hideEngBtn?: boolean;
}) => {
  embed: (
    element: HTMLElement,
    options?: { q?: string; autoClose?: boolean }
  ) => void;
};

declare global {
  interface Window {
    kakao?: { Postcode: PostcodeCtor };
    daum?: { Postcode: PostcodeCtor };
  }
}

function getPostcodeConstructor(): PostcodeCtor | null {
  if (typeof window === "undefined") return null;
  return window.kakao?.Postcode ?? window.daum?.Postcode ?? null;
}

export default function KakaoPostcodePicker({
  rawAddress,
  onPick,
  onStatus,
  inputSlot,
  searchButtonLabel = "주소 추출 시작",
  autoOpenTrigger = 0,
  closeSignal = 0,
  searchButtonBelow = false,
}: KakaoPostcodePickerProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [embedPending, setEmbedPending] = useState(false);

  useEffect(() => {
    if (getPostcodeConstructor()) setScriptReady(true);
  }, []);

  const closeSearch = useCallback(() => {
    setOpen(false);
    setEmbedPending(false);
    if (wrapRef.current) {
      wrapRef.current.innerHTML = "";
      wrapRef.current.style.height = "";
    }
  }, []);

  const openSearch = useCallback(() => {
    const raw = rawAddress.trim();
    if (!raw) {
      onStatus?.("먼저 주소를 입력해 주세요.");
      return;
    }
    if (!getPostcodeConstructor()) {
      onStatus?.("우편번호 서비스를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    setOpen(true);
    setEmbedPending(true);
  }, [rawAddress, onStatus]);

  const consumedAutoOpenRef = useRef(0);

  useEffect(() => {
    if (
      autoOpenTrigger > 0 &&
      autoOpenTrigger !== consumedAutoOpenRef.current &&
      rawAddress.trim()
    ) {
      consumedAutoOpenRef.current = autoOpenTrigger;
      openSearch();
    }
  }, [autoOpenTrigger, rawAddress, openSearch]);

  useEffect(() => {
    if (closeSignal > 0) closeSearch();
  }, [closeSignal, closeSearch]);

  useEffect(() => {
    if (!open || !embedPending) return;

    let cancelled = false;
    const parsed = extractDetailAddress(rawAddress.trim());

    const runEmbed = () => {
      if (cancelled) return;
      const Postcode = getPostcodeConstructor();
      const wrap = wrapRef.current;
      if (!Postcode) return;
      if (!wrap) {
        requestAnimationFrame(runEmbed);
        return;
      }

      wrap.innerHTML = "";
      const postcode = new Postcode({
        oncomplete: (data) => {
          const result = formatSelectedPostcodeAddress(data, parsed.detail);
          onPick(result);
          onStatus?.("주소를 적용했습니다.");
          closeSearch();
        },
        onresize: (size) => {
          if (wrapRef.current) {
            wrapRef.current.style.height = `${Math.max(size.height, 420)}px`;
          }
        },
        hideMapBtn: true,
        hideEngBtn: true,
      });

      postcode.embed(wrap, { q: parsed.base, autoClose: true });
      onStatus?.("추출한 주소로 검색했습니다. 결과를 선택해 주세요.");
      setEmbedPending(false);
    };

    runEmbed();
    return () => {
      cancelled = true;
    };
  }, [open, embedPending, rawAddress, onPick, onStatus, closeSearch]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (getPostcodeConstructor()) {
        setScriptReady(true);
        window.clearInterval(timer);
      }
    }, 200);
    return () => window.clearInterval(timer);
  }, []);

  const searchButton = (
    <button
      type="button"
      onClick={openSearch}
      disabled={!rawAddress.trim() || (open && embedPending)}
      className={`flex items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 ${
        searchButtonBelow ? "w-full sm:w-auto" : "shrink-0"
      }`}
      title="카카오 우편번호 검색"
    >
      {!scriptReady && open && embedPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <MapPin className="h-4 w-4" />
      )}
      {searchButtonLabel}
    </button>
  );

  return (
    <div className="space-y-2">
      {searchButtonBelow ? (
        <>
          <div className="w-full min-w-0">{inputSlot}</div>
          {searchButton}
        </>
      ) : (
        <div className="flex gap-2">
          {inputSlot}
          {searchButton}
        </div>
      )}
        {open && (
          <div className="rounded-lg border border-slate-200 bg-white p-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs text-slate-500">
                원문에서 추출한 주소로 검색합니다. 맞는 결과를 클릭하면
                우편번호·정제 주소가 채워집니다.
              </p>
              <button
                type="button"
                onClick={closeSearch}
                className="shrink-0 text-xs text-slate-500 hover:text-slate-700"
              >
                닫기
              </button>
            </div>
            <div ref={wrapRef} className="w-full min-h-[420px]" />
          </div>
        )}
    </div>
  );
}
