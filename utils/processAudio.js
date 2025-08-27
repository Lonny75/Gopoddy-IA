import { exec } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";

const execAsync = promisify(exec);

// Gestion des chemins
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Traite un fichier audio avec FFmpeg
 * @param {string} inputPath - chemin du fichier audio source
 * @param {string} outputPath - chemin du fichier audio traité
 * @param {object} options - options de traitement (eq, normalize, etc.)
 */
export async function processAudio(inputPath, outputPath, options = {}) {
  try {
    // Exemple simple : normalisation + conversion en MP3
    const command = `ffmpeg -y -i "${inputPath}" -af loudnorm "${outputPath}"`;

    console.log("Exécution FFmpeg :", command);

    const { stderr } = await execAsync(command);

    if (stderr) {
      console.log("FFmpeg log:", stderr);
    }

    return {
      success: true,
      outputPath,
    };
  } catch (err) {
    console.error("Erreur FFmpeg :", err);
    return {
      success: false,
      error: err.message,
    };
  }
}
