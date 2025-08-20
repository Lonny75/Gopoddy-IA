import { downloadFile } from "./utils/downloadFile.js";
import { uploadFile } from "./utils/uploadFile.js";
import { getAudioDuration } from "./utils/getAudioDuration.js";
import supabase from "./supabaseClient.js";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";

const execPromise = promisify(exec);

export default async function processAudio({ inputUrl, projectId, userId, options }) {
  try {
    const inputPath = `/tmp/input-${Date.now()}.mp3`;
    const outputPath = `/tmp/output-${Date.now()}.mp3`;

    // 1️⃣ Télécharger le fichier depuis Supabase
    await downloadFile(inputUrl, inputPath);

    // 2️⃣ Appliquer traitement FFmpeg basique (ex: normalisation)
    await execPromise(`ffmpeg -y -i ${inputPath} -af loudnorm ${outputPath}`);

    // 3️⃣ Calculer la durée du fichier
    const duration = await getAudioDuration(outputPath);

    // 4️⃣ Uploader le fichier traité
    const processedFileUrl = await uploadFile(outputPath, `processed/${Date.now()}.mp3`);

    // 5️⃣ Mettre à jour Supabase DB
    await supabase.from("projects").update({
      status: "completed",
      processed_file_path: processedFileUrl,
      duration
    }).eq("id", projectId);

    // 6️⃣ Nettoyer fichiers temporaires
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);

    return { success: true, processedFileUrl, duration };
  } catch (err) {
    console.error("❌ Erreur processAudio:", err);
    if (projectId) {
      await supabase.from("projects").update({ status: "failed" }).eq("id", projectId);
    }
    throw err;
  }
}
