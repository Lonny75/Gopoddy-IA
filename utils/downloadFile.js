// utils/downloadFile.js
import fs from "fs";
import fetch from "node-fetch";

/**
 * Télécharge un fichier à partir d'une URL publique et l'enregistre temporairement
 * @param {string} url - URL du fichier à télécharger
 * @param {string} outputPath - Chemin de sortie (ex: "./tmp/audio.wav")
 * @returns {Promise<string>} - Retourne le chemin du fichier téléchargé
 */
export default async function downloadFile(url, outputPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erreur téléchargement: ${res.statusText}`);

  const buffer = await res.buffer();
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}
