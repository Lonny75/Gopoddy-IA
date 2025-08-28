import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { createClient } from "@supabase/supabase-js";

// Charger _env
const _envPath = path.resolve(process.cwd(), "_env");
if (fs.existsSync(_envPath)) {
  const envContent = fs.readFileSync(_envPath, "utf-8");
  envContent.split("\n").forEach(line => {
    const [key, ...vals] = line.split("=");
    if (key) process.env[key.trim()] = vals.join("=").trim();
  });
} else {
  console.warn("⚠️ Fichier _env introuvable");
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function processAudio({ inputUrl, projectId, userId, options }) {
  console.log("🔹 Début du processAudio");
  console.log("Input URL:", inputUrl);

  try {
    // 1️⃣ Télécharger le fichier depuis Supabase (fetch natif Node.js)
    const response = await fetch(inputUrl);
    if (!response.ok) throw new Error(`Erreur téléchargement: ${response.statusText}`);

    const tempFileName = path.join("/tmp", `input_${Date.now()}.mp3`);
    const fileStream = fs.createWriteStream(tempFileName);
    await new Promise((resolve, reject) => {
      response.body.pipe(fileStream);
      response.body.on("error", reject);
      fileStream.on("finish", resolve);
    });
    console.log("✅ Fichier téléchargé localement:", tempFileName);

    // 2️⃣ Préparer le fichier de sortie
    const outputFileName = path.join("/tmp", `output_${Date.now()}.mp3`);

    // 3️⃣ Construire la commande FFmpeg
    let ffmpegCmd = `ffmpeg -y -i "${tempFileName}"`;
    if (options?.normalize) ffmpegCmd += " -filter:a loudnorm";
    ffmpegCmd += ` "${outputFileName}"`;

    console.log("🔹 Commande FFmpeg:", ffmpegCmd);

    // 4️⃣ Exécuter FFmpeg
    await new Promise((resolve, reject) => {
      exec(ffmpegCmd, (error, stdout, stderr) => {
        console.log("🔹 FFmpeg stdout:", stdout);
        console.log("🔹 FFmpeg stderr:", stderr);

        if (error) return reject(error);
        resolve();
      });
    });

    // 5️⃣ Upload dans Supabase
    const processedPath = `${projectId}/output_${Date.now()}.mp3`;
    const fileBuffer = fs.readFileSync(outputFileName);

    const { error: uploadError } = await supabase.storage
      .from("audio-files")
      .upload(processedPath, fileBuffer, { upsert: true });

    if (uploadError) throw uploadError;

    console.log("✅ Fichier traité uploadé:", processedPath);

    // 6️⃣ Récupérer l'URL publique
    const { data } = supabase.storage.from("audio-files").getPublicUrl(processedPath);
    const processedUrl = data.publicUrl;

    // Nettoyage fichiers
    fs.unlinkSync(tempFileName);
    fs.unlinkSync(outputFileName);

    console.log("🔹 ProcessAudio terminé avec succès");
    return { success: true, processedUrl, processedPath };

  } catch (err) {
    console.error("❌ processAudio erreur:", err);
    return { success: false, error: err.message };
  }
}
