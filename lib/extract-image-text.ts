/** 문자 스크린샷에서 텍스트 추출 (브라우저, tesseract.js) */
export async function extractTextFromImage(file: Blob): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("kor+eng");
  try {
    const {
      data: { text },
    } = await worker.recognize(file);
    return text.trim();
  } finally {
    await worker.terminate();
  }
}
