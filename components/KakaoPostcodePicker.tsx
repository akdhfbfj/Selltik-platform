"use client";

import {
  extractDetailAddress,
  formatSelectedPostcodeAddress,
  type PostcodeSelection,
} from "@/lib/extract-detail-address";
import { MapPin } from "lucide-react";
import Script from "next/script";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const POSTCODE_SCRIPT =
  "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

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
}

type PostcodeInstance = {
  embed: (
    element: HTMLElement,
    options?: { q?: string; autoClose?: boolean }
  ) => void;
};

declare global {
  interface Window {
    kakao?: {
      Postcode: new (options: {
        oncomplete: (data: PostcodeSelection) => void;
        onresize?: (size: { height: number }) => void;
        hideMapBtn?: boolean;
        hideEngBtn?: boolean;
      }) => PostcodeInstance;
    };
  }
}

export default function KakaoPostcodePicker({
  rawAddress,
  onPick,
  onStatus,
  inputSlot,
}: KakaoPostcodePickerProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (window.kakao?.Postcode) setScriptReady(true);
  }, []);

  const closeSearch = useCallback(() => {
    setOpen(false);
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
    if (!window.kakao?.Postcode) {
      onStatus?.("우편번호 서비스를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    if (!wrapRef.current) return;

    setLoading(true);
    setOpen(true);
    const parsed = extractDetailAddress(raw);
    wrapRef.current.innerHTML = "";

    const postcode = new window.kakao.Postcode({
      oncomplete: (data) => {
        const result = formatSelectedPostcodeAddress(data, parsed.detail);
        onPick(result);
        onStatus?.("주소를 적용했습니다.");
        closeSearch();
        setLoading(false);
      },
      onresize: (size) => {
        if (wrapRef.current) {
          wrapRef.current.style.height = `${Math.max(size.height, 420)}px`;
        }
      },
      hideMapBtn: true,
      hideEngBtn: true,
    });

    postcode.embed(wrapRef.current, { q: parsed.base, autoClose: true });
    onStatus?.("추출한 주소로 검색했습니다. 결과를 선택해 주세요.");
    setLoading(false);
  }, [rawAddress, onPick, onStatus, closeSearch]);

  return (
    <>
      <Script
        src={POSTCODE_SCRIPT}
        strategy="lazyOnload"
        onReady={() => setScriptReady(true)}
      />
      <div className="space-y-2">
        <div className="flex gap-2">
          {inputSlot}
          <button
            type="button"
            onClick={openSearch}
            disabled={loading || !rawAddress.trim() || !scriptReady}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            title="카카오 우편번호 검색"
          >
            <MapPin className="h-4 w-4" />
            검색
          </button>
        </div>
        {open && (
          <div className="rounded-lg border border-slate-200 bg-white p-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs text-slate-500">
                추출한 주소로 검색합니다. 맞는 결과만 선택하세요.
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
    </>
  );
}
