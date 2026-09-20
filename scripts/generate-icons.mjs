// 앱 아이콘(홈 화면 추가용) 생성 스크립트. 로고 변경 시 이 파일만 수정 후 재실행.
// 실행: node scripts/generate-icons.mjs
import sharp from "sharp";
import { mkdirSync } from "fs";

const BRAND_COLOR = "#006fc5";

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BRAND_COLOR}"/>
  <text x="256" y="322" font-family="Arial, Helvetica, sans-serif" font-weight="800"
        font-size="260" fill="#ffffff" text-anchor="middle">S</text>
</svg>
`;

mkdirSync("public", { recursive: true });

const targets = [
  { file: "public/icon-512.png", size: 512 },
  { file: "public/icon-192.png", size: 192 },
  { file: "public/apple-touch-icon.png", size: 180 },
  { file: "public/favicon-32.png", size: 32 },
];

const svgBuffer = Buffer.from(svg);

await Promise.all(
  targets.map(({ file, size }) =>
    sharp(svgBuffer).resize(size, size).png().toFile(file)
  )
);

console.log("아이콘 생성 완료:", targets.map((t) => t.file).join(", "));
