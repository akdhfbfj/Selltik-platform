import { cleanOcrSmsText } from "./ocr-cleanup";

async function preprocessImageForOcr(file: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(2.5, Math.max(1, 1400 / Math.max(bitmap.width, 1)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.filter = "contrast(1.15)";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

/** 문자 스크린샷에서 텍스트 추출 (브라우저, tesseract.js) */
export async function extractTextFromImage(file: Blob): Promise<string> {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("kor+eng");
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
    });
    const source = await preprocessImageForOcr(file);
    const {
      data: { text },
    } = await worker.recognize(source);
    return cleanOcrSmsText(text.trim());
  } finally {
    await worker.terminate();
  }
}
