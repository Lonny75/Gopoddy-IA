// utils/processAudio.js
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import { get } from "https";
import path from "path";

// Télécharge le fichier source vers /tmp sans axios
export function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const request = get(url, (response) => {
      if (response.statusCode !== 200) {
        return reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
      }
      response.pipe(file);
    });

    file.on("finish", () => file.close(resolve));
    file.on("error", (err) => {
      fs.unlink(dest, () => reject(err));
    });

    request.on("error", (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

// Fonction principale
export async function processAudio(inputUrl, projectId, options = {}) {
  try {
    const preset = options.preset || "standard";
    const validPresets = ["standard", "medium", "advanced"];
    if (!validPresets.includes(preset)) {
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
