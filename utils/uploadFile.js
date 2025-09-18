// utils/uploadFile.js
import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Upload un fichier local dans Supabase Storage
 */
export async function uploadFile(localPath, storagePath) {
  const fileBuffer = fs.readFileSync(localPath);

  const { error } = await supabase.storage
    .from("audio-files/processed")
    .upload(storagePath, fileBuffer, {
      contentType: "audio/mpeg",
      upsert: true,
    });

  if (error) throw error;

  const { data: publicUrl } = supabase.storage
    .from("audio-files/processed")
    .getPublicUrl(storagePath);

  return publicUrl.publicUrl;
}
