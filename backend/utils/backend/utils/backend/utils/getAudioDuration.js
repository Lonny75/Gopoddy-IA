// backend/utils/getAudioDuration.js
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Récupère la durée d’un fichier audio via ffprobe
 * @param {string} filePath - Chemin local du fichier
 * @returns {Promise<number>} - Durée en secondes
 */
export default async function getAudioDuration(filePath) {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
    );
    return Math.floor(parseFloat(stdout.trim()));
  } catch (err) {
    console.error("Erreur ffprobe:", err);
    return 0;
  }
}
