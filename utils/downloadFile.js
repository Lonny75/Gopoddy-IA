// utils/downloadFile.js
import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Télécharge un fichier depuis Supabase Storage vers localPath
 */
export async function downloadFile(storagePath, localPath) {
  const { data, error } = await supabase.storage
    .from("audio-files")
    .download(storagePath);

  if (error) throw error;

  const buffer = Buffer.from(await data.arrayBuffer());
  fs.writeFileSync(localPath, buffer);
}
