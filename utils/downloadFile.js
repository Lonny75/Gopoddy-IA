import fs from "fs";
import path from "path";

/**
 * Télécharge un fichier depuis une URL et l’enregistre en local
 * @param {string} url - URL du fichier source
 * @param {string} destFolder - dossier local de destination
 * @returns {Promise<string>} chemin local du fichier téléchargé
 */
export async function downloadFile(url, destFolder) {
  console.log(`⬇️ [downloadFile] Downloading from: ${url}`);

  const fileName = path.basename(new URL(url).pathname);
  const destPath = path.join(destFolder, fileName);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Échec du téléchargement: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(arrayBuffer));

  console.log(`✅ [downloadFile] File saved to: ${destPath}`);
  return destPath;
}
