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
