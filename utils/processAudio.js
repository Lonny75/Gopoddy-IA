// utils/processAudio.js
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

// Instancie Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Téléchargement du fichier
async function downloadFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erreur téléchargement: ${res.statusText}`);
  const fileStream = fs.createWriteStream(dest);
  await new Promise((resolve, reject) => {
    res.body.pipe(fileStream);
    res.body.on("error", reject);
    fileStream.on("finish", resolve);
  });
}

// Obtenir la durée d'un fichier
function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration);
    });
  });
}

// Fonction principale
export async function processAudio({ inputUrl, projectId, userId, preset = "standard" }) {
  try {
    if (!inputUrl || !projectId || !userId)
      throw new Error("Champs manquants: inputUrl, projectId, userId requis");

    if (!["standard", "medium", "advanced"].includes(preset))
      throw new Error(`Preset inconnu: ${preset}`);

    console.log(`🚀 Starting processing for project ${projectId}`);
    
    const inputPath = `/tmp/input_${projectId}.mp3`;
    const outputPath = `/tmp/output_${projectId}.mp3`;

    // Téléchargement
    console.log("⬇️ Downloading input file...");
    await downloadFile(inputUrl, inputPath);

    // Traitement audio
    console.log(`🎚️ Processing audio with preset: ${preset}`);
    await new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath).audioCodec("libmp3lame");
      if (preset === "standard") command = command.audioFilters("loudnorm");
      if (preset === "medium")
        command = command.audioFilters([
          "loudnorm",
          "compand=attacks=0:decays=0:points=-80/-80|-20/-20|0/-10|20/-8",
        ]);
      if (preset === "advanced")
        command = command.audioFilters([
          "loudnorm",
          "compand=attacks=0:decays=0:points=-80/-80|-20/-20|0/-10|20/-8",
          "highpass=f=200, lowpass=f=12000",
        ]);

      command
        .on("end", () => resolve())
        .on("error", reject)
        .save(outputPath);
    });

    // Récupération durée
    const duration = await getAudioDuration(outputPath);

    // Upload sur Supabase
    const fileName = `processed/${path.basename(outputPath)}`;
    const fileData = fs.readFileSync(outputPath);
    const { error: uploadError } = await supabase.storage
      .from("audio-files")
      .upload(fileName, fileData, { upsert: true });
    if (uploadError) throw uploadError;

    // URL publique
    const publicUrl = supabase.storage.from("audio-files").getPublicUrl(fileName).data.publicUrl;

    // Mise à jour DB
    const { error: dbError } = await supabase
      .from("projects")
      .update({
        processed_file_path: fileName,
        processed_file_url: publicUrl,
        duration,
        status: "completed",
      })
      .eq("id", projectId);
    if (dbError) throw dbError;

    console.log("✅ Processing terminé et upload effectué");

    return {
      success: true,
      projectId,
      userId,
      result: { preset, outputPath, publicUrl, duration },
    };
  } catch (err) {
    console.error("❌ Processing failed:", err);

    // Update DB si erreur
    if (projectId) {
      await supabase
        .from("projects")
        .update({ status: "failed" })
        .eq("id", projectId);
    }

    return { success: false, error: err.message };
  }
}
