// utils/processAudio.js
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import https from "https";
import http from "http";
import { createClient } from "@supabase/supabase-js";

// --- Configuration globale ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET_NAME || "audio-files";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("❌ Supabase URL ou Service Role Key manquante !");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// --- Téléchargement du fichier source ---
async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const client = url.startsWith("https") ? https : http;

    client
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          return reject(new Error(`⛔ Échec du téléchargement : ${response.statusCode}`));
        }
        response.pipe(file);
        file.on("finish", () => file.close(() => resolve(dest)));
      })
      .on("error", (err) => {
        fs.unlink(dest, () => reject(err));
      });
  });
}

// --- Récupération de la durée ---
function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(new Error(`Erreur FFprobe : ${err.message}`));
      resolve(metadata.format.duration || 0);
    });
  });
}

// --- Nom de fichier "friendly" ---
function getFriendlyName(inputUrl) {
  const fileName = path.basename(inputUrl, path.extname(inputUrl));
  return fileName.replace(/[_-]+/g, " ").trim();
}

// --- Vérifie ou crée un projet ---
async function ensureProjectExists(projectId, userId) {
  const { data: project, error } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .single();

  if (error && error.code !== "PGRST116") throw error;

  if (!project) {
    const { error: insertError } = await supabase.from("projects").insert([
      { id: projectId, user_id: userId, name: "Projet audio", status: "processing" },
    ]);
    if (insertError) throw insertError;
    console.log(`🆕 Projet créé automatiquement (${projectId})`);
  }
}

// --- Fonction principale ---
export async function processAudio(inputUrl, projectId, userId, options = {}) {
  console.log(`🚀 Traitement lancé pour le projet ${projectId} (${userId})`);

  await ensureProjectExists(projectId, userId);

  const inputPath = `/tmp/input_${projectId}.mp3`;
  const friendlyName = getFriendlyName(inputUrl);
  const outputPath = `/tmp/${friendlyName}_NiceMasterPro.mp3`;

  // Dossier par défaut pour tous les traitements actuels
  const folder = "mastered-files";
  const supabasePath = `${folder}/${friendlyName}_NiceMasterPro.mp3`;

  try {
    console.log("⬇️ Téléchargement du fichier source...");
    await downloadFile(inputUrl, inputPath);

    console.log("🎛️ Traitement FFmpeg (preset Nice Master Pro)...");
    const startTime = Date.now();

    await new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .audioCodec("libmp3lame")
        .audioFilters([
          "loudnorm=I=-14:TP=-1.5:LRA=10",
          "acompressor=threshold=-18dB:ratio=2.5:attack=20:release=200:makeup=4",
          "highpass=f=35",
          "equalizer=f=60:t=q:w=1.2:g=-1",
          "equalizer=f=150:t=q:w=1.2:g=1.5",
          "equalizer=f=400:t=q:w=1.2:g=-0.5",
          "equalizer=f=2000:t=q:w=1.2:g=1",
          "equalizer=f=8000:t=q:w=2:g=2",
          "equalizer=f=12000:t=q:w=2:g=1",
          "alimiter=limit=0.97",
          "aformat=sample_fmts=s16:channel_layouts=stereo",
        ])
        .on("start", (cmd) => console.log("▶️ FFmpeg :", cmd))
        .on("progress", (p) => {
          if (p.percent) console.log(`📊 Progression : ${p.percent.toFixed(1)}%`);
        })
        .on("end", resolve)
        .on("error", (err) => reject(err))
        .save(outputPath);

      // Timeout sécurité
      setTimeout(() => {
        command.kill("SIGKILL");
        reject(new Error("⏱️ Timeout FFmpeg (2 minutes)"));
      }, 120000);
    });

    console.log("⏱️ Analyse de la durée audio...");
    const duration = await getAudioDuration(outputPath);

    console.log("⬆️ Upload vers Supabase Storage...");
    const fileBuffer = fs.readFileSync(outputPath);
    const { error: uploadError } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(supabasePath, fileBuffer, {
        upsert: true,
        contentType: "audio/mpeg",
      });

    if (uploadError) throw new Error(`Échec de l'upload : ${uploadError.message}`);

    console.log("🔗 Génération de l'URL signée...");
    const { data: signed, error: signedError } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .createSignedUrl(supabasePath, 60 * 60 * 24 * 30); // 30 jours

    if (signedError) throw new Error(`Erreur URL signée : ${signedError.message}`);
    const signedUrl = signed?.signedUrl || null;

    const stats = fs.statSync(outputPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    console.log("📝 Mise à jour du projet...");
    const { error: updateError } = await supabase
      .from("projects")
      .update({
        processed_file_path: supabasePath,
        processed_file_url: signedUrl,
        duration,
        status: "completed",
      })
      .eq("id", projectId);

    if (updateError) throw updateError;

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Traitement terminé (${sizeMB} MB / ${elapsed}s)`);

    return { outputUrl: signedUrl, duration, sizeMB };
  } catch (err) {
    console.error("❌ Erreur globale :", err.message);
    await supabase
      .from("projects")
      .update({ status: "failed", error_message: err.message })
      .eq("id", projectId);
    throw err;
  } finally {
    try {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      console.log("🧹 Fichiers temporaires nettoyés.");
    } catch (cleanupErr) {
      console.warn("⚠️ Erreur nettoyage :", cleanupErr.message);
    }
  }
}
