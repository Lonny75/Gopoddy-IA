// utils/getAudioDuration.js
import ffmpeg from "fluent-ffmpeg";

/**
 * Renvoie la durée d'un fichier audio en secondes
 * @param {string} filePath - Chemin vers le fichier audio
 * @returns {Promise<number>} - Durée en secondes
 */
export default function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const duration = metadata.format.duration;
      resolve(duration);
    });
  });
}
