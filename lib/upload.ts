import path from "path";
import { v4 as uuidv4 } from "uuid";
import { createServerClient, STORAGE_BUCKET } from "./supabase/server";

function storagePathFromPublicUrl(imageUrl: string): string | null {
  const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
  const idx = imageUrl.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(imageUrl.slice(idx + marker.length));
}

export async function saveUploadedFile(
  file: File,
  prefix: string
): Promise<string> {
  const supabase = createServerClient();
  const ext = path.extname(file.name) || ".png";
  const storagePath = `images/${prefix}-${uuidv4()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type || "image/png",
      upsert: false,
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath);

  return data.publicUrl;
}

export async function deleteUploadedFile(imageUrl: string) {
  const storagePath = storagePathFromPublicUrl(imageUrl);
  if (!storagePath) return;

  const supabase = createServerClient();
  await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
}

export async function deleteContactImages(imagePaths: string[]) {
  await Promise.all(imagePaths.map(deleteUploadedFile));
}

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const XLS_MIME = "application/vnd.ms-excel";

export async function saveProposalFile(
  file: File,
  contactId: string
): Promise<{ storagePath: string; publicUrl: string }> {
  const supabase = createServerClient();
  const ext = path.extname(file.name).toLowerCase() || ".xlsx";
  const storagePath = `proposals/${contactId}/${uuidv4()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  let contentType = file.type;
  if (!contentType) {
    if (ext === ".xls") contentType = XLS_MIME;
    else if (ext === ".xlsx") contentType = XLSX_MIME;
    else contentType = "application/octet-stream";
  }

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, {
      contentType,
      upsert: false,
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath);

  return { storagePath, publicUrl: data.publicUrl };
}

export async function downloadStorageFile(
  storagePath: string
): Promise<{ buffer: Buffer; contentType: string }> {
  const supabase = createServerClient();
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(storagePath);

  if (error || !data) throw error ?? new Error("파일을 찾을 수 없습니다.");

  const buffer = Buffer.from(await data.arrayBuffer());
  const ext = path.extname(storagePath).toLowerCase();
  let contentType = "application/octet-stream";
  if (ext === ".xlsx") contentType = XLSX_MIME;
  else if (ext === ".xls") contentType = XLS_MIME;

  return { buffer, contentType };
}

export async function deleteStorageFile(storagePath: string) {
  const supabase = createServerClient();
  await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
}
