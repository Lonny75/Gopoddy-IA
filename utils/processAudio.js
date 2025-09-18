// server/utils/processAudio.js
import { exec } from "child_process";
import path from "path";

/**
 * Traite un fichier audio selon un preset
 * @param {string} inputPath - chemin du fichier source
 * @param {string} preset - "nice" ou "podcast"
 * @returns {Promise<string>} chemin du fichier de sortie
 */
export function processAudio(inputPath, preset) {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(
      "/tmp",
      `output-${Date.now()}-${preset}.mp3`
    );

    let ffmpegCmd = "";

    if (preset === "nice") {
      // Normalisation + compression
      ffmpegCmd = `ffmpeg -i "${inputPath}" -af "loudnorm,acompressor" -y "${outputPath}"`;
    } else if (preset === "podcast") {
      // Filtrage et réduction de bruit
      ffmpegCmd = `ffmpeg -i "${inputPath}" -af "highpass=f=200,lowpass=f=3000,afftdn" -y "${outputPath}"`;
    } else {
      return reject(new Error(`Preset inconnu: ${preset}`));
    }

    exec(ffmpegCmd, (err) => {
      if (err) {
        return reject(new Error("Erreur lors du traitement audio avec ffmpeg"));
      }
      resolve(outputPath);
    });
  });
}
