// backend/utils/uploadFile.js
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Upload un fichier local dans Supabase Storage
 * @param {string} bucket - Nom du bucket (ex: "audio-files")
 * @param {string} filePath - Chemin local du fichier à uploader
 * @param {string} storagePath - Chemin dans Supabase (ex: "processed/audio.wav")
 * @returns {Promise<string>} - URL publique du fichier
 */
export default async function uploadFile(bucket, filePath, storagePath) {
  const fileBuffer = fs.readFileSync(filePath);

  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, fileBuffer, {
      upsert: true,
      contentType: "audio/wav",
    });

  if (error) throw new Error("Erreur upload Supabase: " + error.message);

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  return data.publicUrl;
}
