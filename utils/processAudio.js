// utils/processAudio.js
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import https from "https";

// Vérification des variables d'environnement
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Supabase URL ou Service Role Key manquante !");
  throw new Error("Supabase URL ou Service Role Key manquante !");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Télécharge un fichier depuis une URL vers un chemin local
export async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        return reject(new Error(`Download failed with status ${response.statusCode}`));
      }
      response.pipe(file);
      file.on("finish", () => {
        file.close(resolve);
      });
    }).on("error", (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

// Fonction principale de traitement
export async function processAudio(inputUrl, projectId, userId, options = {}) {
  try {
    const preset = options.preset || "standard";
    if (!["standard", "medium", "advanced"].includes(preset)) {
      throw new Error(`Preset inconnu: ${preset}`);
    }

    console.log(`🎛️ Applying preset: ${preset}`);

    const inputPath = `/tmp/input_${projectId}.mp3`;
    const outputPath = `/tmp/output_${projectId}.mp3`;

    console.log("⬇️ Downloading input file...");
    await downloadFile(inputUrl, inputPath);

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
        .on("error", (err) => {
          console.error("❌ FFmpeg error:", err);
          reject(err);
        })
        .save(outputPath);
    });

    // Upload sur Supabase Storage
    const storagePath = `processed/output_${projectId}.mp3`;
    console.log("⬆️ Uploading processed file to Supabase Storage...");
    const { data, error: uploadError } = await supabase.storage
      .from("audio-files")
      .upload(storagePath, fs.createReadStream(outputPath), {
        contentType: "audio/mpeg",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { publicUrl, error: urlError } = supabase.storage
      .from("audio-files")
      .getPublicUrl(storagePath);

    if (urlError) throw urlError;

    // Mise à jour de la DB
    console.log("📝 Updating database with processed file info...");
    const { error: dbError } = await supabase
      .from("projects")
      .update({
        processed_file_path: storagePath,
        processed_file_url: publicUrl,
        status: "completed",
        preset: preset,
      })
      .eq("id", projectId);

    if (dbError) throw dbError;

    const stats = fs.statSync(outputPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    return {
      success: true,
      projectId,
      userId,
      result: {
        preset,
        outputPath: storagePath,
        publicUrl,
        sizeMB,
        message: "Processing terminé avec succès",
      },
    };
  } catch (err) {
    console.error("❌ Processing failed:", err);

    // Mise à jour du statut en cas d'erreur
    if (projectId) {
      await supabase
        .from("projects")
        .update({ status: "failed", error_message: err.message })
        .eq("id", projectId);
    }

    throw err;
  }
}
