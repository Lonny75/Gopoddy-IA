// server/utils/processAudio.js
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

// ⚡ Charger les variables depuis _env
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

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("❌ Variables d'environnement Supabase manquantes !");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function processAudio({ inputUrl, projectId, userId, options }) {
  console.log("🔹 Début du processAudio");
  console.log("Input URL:", inputUrl);

  try {
    // 1️⃣ Télécharger le fichier depuis Supabase
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
    if (options.normalize) {
      ffmpegCmd += " -filter:a loudnorm";
    }
    ffmpegCmd += ` "${outputFileName}"`;

    console.log("🔹 Commande FFmpeg:", ffmpegCmd);

    // 4️⃣ Exécuter FFmpeg avec logs
    await new Promise((resolve, reject) => {
      const ff = exec(ffmpegCmd, (error, stdout, stderr) => {
        console.log("🔹 FFmpeg stdout:", stdout);
        console.log("🔹 FFmpeg stderr:", stderr);

        if (error) {
          console.error("❌ Erreur FFmpeg:", error);
          reject(error);
        } else {
          console.log("✅ FFmpeg terminé");
          resolve();
        }
      });
    });

    // 5️⃣ Déterminer le dossier d’upload selon projectId
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const folder = uuidRegex.test(projectId) ? projectId : "processed";
    const processedPath = `${folder}/output_${Date.now()}.mp3`;

    // 6️⃣ Upload sur Supabase
    const fileBuffer = fs.readFileSync(outputFileName);
    const { error: uploadError } = await supabase.storage
      .from("audio-files")
      .upload(processedPath, fileBuffer, { upsert: true });
    if (uploadError) throw uploadError;

    console.log("✅ Fichier traité uploadé:", processedPath);

    // 7️⃣ Récupérer l'URL publique
    const { publicUrl } = supabase.storage.from("audio-files").getPublicUrl(processedPath);

    // 8️⃣ Mettre à jour la DB
    const { error: dbError } = await supabase
      .from("projects")
      .update({
        processed_file_path: processedPath,
        processed_file_url: publicUrl,
        status: "completed",
      })
      .eq("id", projectId);

    if (dbError) throw dbError;
    console.log("✅ DB mise à jour pour projectId:", projectId);

    // 9️⃣ Nettoyer fichiers temporaires
    fs.unlinkSync(tempFileName);
    fs.unlinkSync(outputFileName);

    console.log("🔹 ProcessAudio terminé avec succès");
    return { success: true, processedUrl: publicUrl };

  } catch (err) {
    console.error("❌ processAudio erreur:", err);

    // Mettre à jour le statut failed si possible
    try {
      await supabase
        .from("projects")
        .update({ status: "failed" })
        .eq("id", projectId);
    } catch (e) {
      console.error("⚠️ Impossible de mettre à jour le statut failed:", e);
    }

    return { success: false, error: err.message };
  }
}
