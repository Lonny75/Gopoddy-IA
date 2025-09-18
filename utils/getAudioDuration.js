// utils/getAudioDuration.js
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import { get } from "https";

// Télécharge un fichier temporaire (réutilisable depuis processAudio)
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

// Récupère la durée d'un fichier audio depuis une URL
export async function getAudioDuration(url, projectId) {
  const tempPath = `/tmp/duration_${projectId}.mp3`;

  try {
    console.log("⬇️ Downloading file to measure duration...");
    await downloadFile(url, tempPath);

    console.log("⏱️ Measuring audio duration...");
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(tempPath, (err, metadata) => {
        if (err) {
          console.error("❌ ffprobe error:", err);
          return reject(err);
        }
        const duration = metadata.format.duration; // durée en secondes
        console.log(`✅ Audio duration: ${duration}s`);
        resolve(duration);
      });
    });
  } catch (err) {
    console.error("❌ Failed to get audio duration:", err);
    throw err;
  } finally {
    // Optionnel : supprimer le fichier temporaire
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  }
}
