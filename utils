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
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Erreur téléchargement fichier : ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(buffer));

  return outputPath;
}
