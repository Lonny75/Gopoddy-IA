// utils/processAudio.js
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Supabase service key (assure-toi qu'elle est bien définie dans les variables d'environnement)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Télécharge un fichier depuis une URL vers /tmp
async function downloadFile(url, dest) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Erreur téléchargement: ${response.statusText}`);
  const arrayBuffer = await response.arrayBuffer();
  await fs.promises.writeFile(dest, Buffer.from(arrayBuffer));
}

// Récupère la durée d'un fichier audio en secondes
function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration);
    });
  });
}

// Fonction principale
export async function processAudio(inputUrl, projectId, userId, options = {}) {
  try {
    const preset = options.preset || "standard";
    if (!["standard", "medium", "advanced"].includes(preset)) {
      throw new Error(`Preset inconnu: ${preset}`);
    }

    console.log(`🚀 Starting processing for project ${projectId}, user ${userId}`);
    console.log(`🎛️ Applying preset: ${preset}`);

    const inputPath = `/tmp/input_${projectId}.mp3`;
    const outputPath = `/tmp/output_${projectId}.mp3`;

    // 1️⃣ Télécharger le fichier
    console.log("⬇️ Downloading input file...");
    await downloadFile(inputUrl, inputPath);

    // 2️⃣ Traitement FFmpeg
    console.log("🎚️ Processing audio...");
    await new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath).audioCodec("libmp3lame");

      if (preset === "standard") {
        command.audioFilters("loudnorm");
      } else if (preset === "medium") {
        command.audioFilters([
          "loudnorm",
          "compand=attacks=0:decays=0:points=-80/-80|-20/-20|0/-10|20/-8",
        ]);
      } else if (preset === "advanced") {
        command.audioFilters([
          "loudnorm",
          "compand=attacks=0:decays=0:points=-80/-80|-20/-20|0/-10|20/-8",
          "highpass=f=200, lowpass=f=12000",
        ]);
      }

      command
        .on("end", () => {
          console.log("✅ Audio processed successfully");
          resolve();
        })
        .on("error", (err) => {
          console.error("❌ FFmpeg error:", err);
          reject(err);
        })
        .save(outputPath);
    });

    // 3️⃣ Récupérer la durée et taille
    const duration = await getAudioDuration(outputPath);
    const stats = fs.statSync(outputPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    // 4️⃣ Upload sur Supabase Storage
    const fileName = `processed/output_${projectId}.mp3`;
    const fileBuffer = await fs.promises.readFile(outputPath);

    const { error: uploadError } = await supabase.storage
      .from("audio-files")
      .upload(fileName, fileBuffer, { upsert: true });

    if (uploadError) throw uploadError;

    const publicUrl = supabase.storage.from("audio-files").getPublicUrl(fileName).data.publicUrl;

    // 5️⃣ Mettre à jour la table projects
    const { error: dbError } = await supabase
      .from("projects")
      .update({
        processed_file_path: fileName,
        processed_file_url: publicUrl,
        duration,
        sizeMB,
        status: "completed",
      })
      .eq("id", projectId);

    if (dbError) throw dbError;

    console.log("📦 Upload complete, DB updated");

    return {
      success: true,
      projectId,
      userId,
      result: { preset, outputPath: fileName, sizeMB, duration, url: publicUrl },
    };
  } catch (err) {
    console.error("❌ Processing failed:", err);
    // Mettre à jour le statut en erreur
    if (projectId) {
      await supabase.from("projects").update({ status: "failed" }).eq("id", projectId);
    }
    throw err;
  }
}
