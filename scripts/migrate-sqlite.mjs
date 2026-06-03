/**
 * 기존 SQLite(data/contacts.db) → Supabase 일회성 이전
 *
 * 사용법:
 *   1. supabase/schema.sql 실행 + uploads 버킷 생성
 *   2. .env에 Supabase 키 설정
 *   3. node scripts/migrate-sqlite.mjs
 */
import Database from "better-sqlite3";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dbPath = path.join(root, "data", "contacts.db");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요");
  process.exit(1);
}

if (!fs.existsSync(dbPath)) {
  console.error(`SQLite 파일 없음: ${dbPath}`);
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false },
});
const db = new Database(dbPath, { readonly: true });

function parseImages(raw) {
  try {
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function uploadLocalImage(relativePath) {
  if (!relativePath.startsWith("/uploads/")) return relativePath;
  const localPath = path.join(root, "public", relativePath);
  if (!fs.existsSync(localPath)) {
    console.warn(`  이미지 없음, 건너뜀: ${relativePath}`);
    return relativePath;
  }
  const storagePath = `images/migrated-${path.basename(localPath)}`;
  const buffer = fs.readFileSync(localPath);
  const ext = path.extname(localPath).toLowerCase();
  const mime =
    ext === ".jpg" || ext === ".jpeg"
      ? "image/jpeg"
      : ext === ".webp"
        ? "image/webp"
        : "image/png";

  const { error } = await supabase.storage
    .from("uploads")
    .upload(storagePath, buffer, { contentType: mime, upsert: true });
  if (error) {
    console.warn(`  업로드 실패: ${relativePath}`, error.message);
    return relativePath;
  }
  const { data } = supabase.storage.from("uploads").getPublicUrl(storagePath);
  return data.publicUrl;
}

async function migrateImages(paths) {
  const out = [];
  for (const p of paths) {
    out.push(await uploadLocalImage(p));
  }
  return out;
}

async function main() {
  console.log("SQLite → Supabase 이전 시작…");

  const recs = db.prepare("SELECT * FROM recommendations").all();
  for (const r of recs) {
    const images = await migrateImages(parseImages(r.images));
    const { error } = await supabase.from("recommendations").upsert({
      id: r.id,
      product_name: r.product_name,
      brand: r.brand ?? "",
      reason: r.reason ?? "",
      reference_url: r.reference_url ?? "",
      desired_price: r.desired_price ?? "",
      seller_name: r.seller_name,
      status: r.status ?? "new",
      images,
      created_at: r.created_at,
      updated_at: r.updated_at,
    });
    if (error) console.error("recommendation", r.id, error.message);
  }
  console.log(`recommendations: ${recs.length}건`);

  const contacts = db.prepare("SELECT * FROM contacts").all();
  for (const c of contacts) {
    const images = await migrateImages(parseImages(c.images));
    const { error } = await supabase.from("contacts").upsert({
      id: c.id,
      company_name: c.company_name,
      contact_person: c.contact_person ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      website: c.website ?? "",
      address: c.address ?? "",
      product_info: c.product_info ?? "",
      notes: c.notes ?? "",
      status: c.status ?? "new",
      tags: c.tags ?? "",
      uploaded_by: c.uploaded_by ?? "",
      recommendation_id: c.recommendation_id || null,
      images,
      created_at: c.created_at,
      updated_at: c.updated_at,
    });
    if (error) console.error("contact", c.id, error.message);
  }
  console.log(`contacts: ${contacts.length}건`);

  let activities = [];
  try {
    activities = db.prepare("SELECT * FROM contact_activities").all();
  } catch {
    console.log("contact_activities 테이블 없음, 건너뜀");
  }
  for (const a of activities) {
    const { error } = await supabase.from("contact_activities").upsert({
      id: a.id,
      contact_id: a.contact_id,
      content: a.content,
      author: a.author ?? "",
      created_at: a.created_at,
    });
    if (error) console.error("activity", a.id, error.message);
  }
  console.log(`activities: ${activities.length}건`);

  console.log("완료!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
