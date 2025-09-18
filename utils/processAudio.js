// utils/processAudio.js
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import axios from "axios";

// Télécharge le fichier source vers /tmp
async function downloadFile(url, dest) {
  const writer = fs.createWriteStream(dest);
  const response = await axios({ url, method: "GET", responseType: "stream" });
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

// Fonction principale
export async function processAudio(inputUrl, projectId, options = {}) {
  try {
    // Vérification preset
    const preset = options.preset || "standard";
    if (!["standard", "medium", "advanced"].includes(preset)) {
      throw new Error(`Preset inconnu: ${preset}`);
    }

    console.log(`🎛️ Applying preset: ${preset}`);

    // Préparer chemins
    const inputPath = `/tmp/input_${projectId}.mp3`;
    const outputPath = `/tmp/output_${projectId}.mp3`;

    // Télécharger le fichier source
    console.log("⬇️ Downloading input file...");
    await downloadFile(inputUrl, inputPath);

    console.log("🎚️ Processing audio with FFmpeg...");

    await new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath).audioCodec("libmp3lame");

      // Exemple de presets
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

    // Vérifier la taille de sortie
    const stats = fs.statSync(outputPath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    return {
      preset,
      outputPath,
      sizeMB: fileSizeMB,
      message: "Processing terminé avec succès",
    };

  } catch (err) {
    console.error("❌ Processing failed:", err);
    throw err;
  }
}
