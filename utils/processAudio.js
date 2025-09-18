// utils/processAudio.js
import { createClient } from "@supabase/supabase-js";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Pour __dirname en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Fonction pour créer le client Supabase ---
function getSupabaseClient() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase URL ou Service Role Key manquante !");
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

// --- Télécharger le fichier localement ---
async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    import("node-fetch").then(({ default: fetch }) => {
      fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error(`Erreur téléchargement: ${res.status}`);
          const fileStream = fs.createWriteStream(dest);
          res.body.pipe(fileStream);
          fileStream.on("finish", resolve);
          fileStream.on("error", reject);
        })
        .catch(reject);
    });
  });
}

// --- Obtenir la durée audio ---
function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration);
    });
  });
}

// --- Fonction principale ---
export async function processAudio(inputUrl, projectId, options = {}) {
  const supabase = getSupabaseClient();
  const bucket = process.env.SUPABASE_BUCKET_NAME || "audio-files";

  try {
    const preset = options.preset || "standard";
    if (!["standard", "medium", "advanced"].includes(preset)) {
      throw new Error(`Preset inconnu: ${preset}`);
    }

    console.log(`🎛️ Applying preset: ${preset}`);

    const inputPath = path.join("/tmp", `input_${projectId}.mp3`);
    const outputPath = path.join("/tmp", `output_${projectId}.mp3`);

    // Télécharger le fichier
    console.log("⬇️ Downloading input file...");
    await downloadFile(inputUrl, inputPath);

    // Traiter avec FFmpeg
    console.log("🎚️ Processing audio with FFmpeg...");
    await new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath).audioCodec("libmp3lame");

      if (preset === "standard") {
        command = command.audioFilters("loudnorm");
      } else if (preset === "medium") {
        command = command.audioFilters([
          "loudnorm",
          "compand=attacks=0:decays=0:points=-80/-80|-20/-20|0/-10|20/-8"
        ]);
      } else if (preset === "advanced") {
        command = command.audioFilters([
          "loudnorm",
          "compand=attacks=0:decays=0:points=-80/-80|-20/-20|0/-10|20/-8",
          "highpass=f=200, lowpass=f=12000"
        ]);
      }

      command
        .on("end", () => {
          console.log("✅ Audio processed successfully");
          resolve();
        })
        .on("error", reject)
        .save(outputPath);
    });

    // Taille et durée
    const stats = fs.statSync(outputPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    const duration = await getAudioDuration(outputPath);

    // Upload vers Supabase
    const supabasePath = `processed/${projectId}_${Date.now()}.mp3`;
    const fileData = fs.readFileSync(outputPath);

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(supabasePath, fileData, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: publicData } = supabase.storage
      .from(bucket)
      .getPublicUrl(supabasePath);

    const processedUrl = publicData.publicUrl;

    // Mise à jour de la DB
    const { error: dbError } = await supabase
      .from("projects")
      .update({
        processed_file_path: supabasePath,
        processed_file_url: processedUrl,
        duration,
        size_mb: sizeMB,
        status: "completed",
      })
      .eq("id", projectId);

    if (dbError) throw dbError;

    return {
      preset,
      outputPath: processedUrl,
      sizeMB,
      duration,
      message: "Processing terminé avec succès",
    };

  } catch (err) {
    console.error("❌ Processing failed:", err);
    // Mettre à jour le statut en erreur dans DB si possible
    try {
      const supabase = getSupabaseClient();
      await supabase.from("projects").update({ status: "failed" }).eq("id", projectId);
    } catch {}
    throw err;
  }
}
