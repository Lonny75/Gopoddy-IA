import fs from "fs";
import supabase from "../supabaseClient.js";

export async function uploadFile(localPath, storagePath) {
  const fileBuffer = fs.readFileSync(localPath);
  const { data, error } = await supabase.storage.from("audio-files").upload(storagePath, fileBuffer, {
    cacheControl: "3600",
    upsert: true,
    contentType: "audio/mpeg"
  });

  if (error) throw error;

  const { data: publicUrl } = supabase.storage.from("audio-files").getPublicUrl(storagePath);
  return publicUrl.publicUrl;
}
