// utils/processAudio.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { downloadFile } from "./downloadFile.js";
import { uploadFile } from "./uploadFile.js";
import { getAudioDuration } from "./utilsAudio.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Traite un fichier audio avec FFmpeg puis réupload dans Supabase
 */
export async function processAudio({ inputPath, preset, projectId }) {
  try {
    // 🔹 Dossier temporaire
    const tmpDir = path.join(__dirname, "../tmp");
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    // 🔹 Fichiers locaux
    const inputFile = path.join(tmpDir, `input-${Date.now()}.mp3`);
    const outputFile = path.join(tmpDir, `output-${Date.now()}.mp3`);

    // 1. Télécharger depuis Supabase Storage
    await downloadFile(inputPath, inputFile);

    // 2. Choisir le preset → juste un exemple simple
    let ffmpegArgs;
    switch (preset) {
      case "nice":
        ffmpegArgs = ["-i", inputFile, "-af", "loudnorm", outputFile];
        break;
      case "bass":
        ffmpegArgs = ["-i", inputFile, "-af", "bass=g=5", outputFile];
        break;
      default:
        ffmpegArgs = ["-i", inputFile, outputFile];
    }

    // 3. Lancer FFmpeg
    await runFfmpeg(ffmpegArgs);

    // 4. Durée du fichier traité
    const duration = await getAudioDuration(outputFile);

    // 5. Upload dans Supabase
    const outputPath = `${projectId}/processed-${Date.now()}.mp3`;
    const outputUrl = await uploadFile(outputFile, outputPath);

    // 6. Nettoyer les fichiers temporaires
    fs.unlinkSync(inputFile);
    fs.unlinkSync(outputFile);

    return { outputUrl, duration };
  } catch (err) {
    console.error("❌ Erreur processAudio:", err.message);
    throw err;
  }
}

/**
 * Lance FFmpeg en promesse
 */
function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", args);

    ffmpeg.stderr.on("data", (data) => {
      console.log("ffmpeg:", data.toString());
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });
  });
}
