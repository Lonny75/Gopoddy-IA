// server/utils/uploadFile.js
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// On utilise le fichier supabaseClient.js si tu l'as, sinon tu peux créer directement le client ici
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Upload un fichier local dans Supabase Storage et renvoie l'URL publique
 * @param {string} localPath - Chemin du fichier sur ton ordinateur
 * @param {string} storagePath - Chemin dans le bucket Supabase
 * @returns {Promise<string>} - URL publique du fichier uploadé
 */
export default async function uploadFile(localPath, storagePath) {
  try {
    const fileBuffer = fs.readFileSync(localPath);

    const { error } = await supabase.storage
      .from("audio-files") // ⚡ adapte si ton bucket a un autre nom
      .upload(storagePath, fileBuffer, {
        contentType: "audio/mpeg", // ou "audio/wav" selon ton fichier
        upsert: true,
      });

    if (error) throw error;

    // Générer l’URL publique
    const { data } = supabase.storage.from("audio-files").getPublicUrl(storagePath);
    return data.publicUrl;
  } catch (err) {
    console.error("Erreur uploadFile:", err);
    throw err;
  }
}
