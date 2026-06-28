import { cleanOcrSmsText } from "./ocr-cleanup";

type OcrWorker = Awaited<
  ReturnType<typeof import("tesseract.js")["createWorker"]>
>;

let workerPromise: Promise<OcrWorker> | null = null;

async function createOcrWorker(): Promise<OcrWorker> {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("kor+eng", 1);
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
  });
  return worker;
}

/** 답장 분석 페이지 진입 시 미리 로드 — 첫 붙여넣기 대기 시간 단축 */
export function warmOcrWorker(): void {
  if (typeof window === "undefined") return;
  if (!workerPromise) {
    workerPromise = createOcrWorker();
  }
}

async function getOcrWorker(): Promise<OcrWorker> {
  if (!workerPromise) {
    workerPromise = createOcrWorker();
  }
  return workerPromise;
}

/** OCR 속도·정확도 균형 — 긴 변 기준 최대 1200px */
export function ocrPreprocessScale(width: number, height: number): number {
  const maxSide = Math.max(width, height, 1);
  if (maxSide <= 900) return Math.min(2, 1200 / maxSide);
  return Math.min(1.5, 1200 / maxSide);
}

async function preprocessImageForOcr(file: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const scale = ocrPreprocessScale(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.filter = "contrast(1.12)";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

/** 문자 스크린샷에서 텍스트 추출 (브라우저, tesseract.js) */
export async function extractTextFromImage(file: Blob): Promise<string> {
  const [worker, source] = await Promise.all([
    getOcrWorker(),
    preprocessImageForOcr(file),
  ]);
  const {
    data: { text },
  } = await worker.recognize(source);
  return cleanOcrSmsText(text.trim());
}
