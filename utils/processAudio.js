// utils/processAudio.js
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import https from "https";
import http from "http";

// --- Supabase ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET_NAME || "audio-files";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Supabase URL ou Service Role Key manquante !");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// --- Téléchargement du fichier ---
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const client = url.startsWith("https") ? https : http;

    client.get(url, (response) => {
      if (response.statusCode !== 200) {
        return reject(new Error(`Download failed with status ${response.statusCode}`));
      }
      response.pipe(file);
      file.on("finish", () => file.close(resolve));
    }).on("error", (err) => fs.unlink(dest, () => reject(err)));
  });
}

// --- Obtenir durée audio ---
function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration);
    });
  });
}

// --- Extraction du Friendly Name depuis le nom de fichier ---
function getFriendlyName(inputUrl) {
  const fileName = path.basename(inputUrl, path.extname(inputUrl)); // ex: 1758271977749-full_arcade_
  const parts = fileName.split("-");
  if (parts.length >= 2) {
    return parts.slice(1).join("-"); // ex: full_arcade_
  }
  return fileName;
}

// --- Vérification / création projet ---
async function ensureProjectExists(projectId, userId) {
  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (error && error.code !== "PGRST116") throw error; // autre erreur

  if (!project) {
    const { error: insertError } = await supabase
      .from("projects")
      .insert([{ id: projectId, user_id: userId, status: "processing" }]);
    if (insertError) throw insertError;
    console.log(`🆕 Projet créé automatiquement : ${projectId}`);
  }
}

// --- Traitement audio principal ---
export async function processAudio(inputUrl, projectId, userId, options = {}) {
  const type = options.type || "music"; // "music" ou "podcast"

  if (!["music", "podcast"].includes(type)) {
    throw new Error(`Type inconnu: ${type}`);
  }

  console.log(`🚀 Processing project ${projectId} (type: ${type}, user: ${userId})`);

  // --- Vérification projet ---
  await ensureProjectExists(projectId, userId);

  const inputPath = `/tmp/input_${projectId}.mp3`;
  const friendlyName = getFriendlyName(inputUrl).replace(/_/g, " ").trim();
  const timestamp = Date.now();
  const outputPath = `/tmp/output_${projectId}_${type}_${timestamp}.mp3`;
  const supabasePath = `processed/${projectId}/${friendlyName}_${type}-v${timestamp}.mp3`;

  // --- Download ---
  console.log("⬇️ Downloading input file...");
  await downloadFile(inputUrl, inputPath);

  // --- FFmpeg processing ---
  console.log("🎚️ Processing with FFmpeg...");
  await new Promise((resolve, reject) => {
    let command = ffmpeg(inputPath).audioCodec("libmp3lame");

    if (type === "music") {
      command = command.audioFilters([
        "acompressor=threshold=-18dB:ratio=2:attack=20:release=250:makeup=7",
        "dynaudnorm=f=150:g=15",
        "equalizer=f=1000:t=q:w=1:g=3",
        "aformat=sample_fmts=s16:channel_layouts=stereo"
      ]);
    } else if (type === "podcast") {
      command = command.audioFilters([
        "highpass=f=80",
        "lowpass=f=12000",
        "afftdn=nf=-25",
        "acompressor=threshold=-20dB:ratio=3:attack=10:release=200:makeup=5",
        "loudnorm=I=-16:LRA=7:TP=-1.5"
      ]);
    }

    command
      .on("end", () => {
        console.log("✅ Audio processed successfully");
        resolve();
      })
      .on("error", (err) => {
        console.error("❌ FFmpeg error:", err);
        reject(err);
      })
      .save(outputPath);
  });

  // --- Durée ---
  const duration = await getAudioDuration(outputPath);

  // --- Upload Supabase ---
  const fileData = fs.readFileSync(outputPath);
  const { error: uploadError } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(supabasePath, fileData, { upsert: false });

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${supabasePath}`;

  // --- Insert dans masterings ---
  const { error: dbError } = await supabase
    .from("masterings")
    .insert([{
      project_id: projectId,
      user_id: userId,
      type,
      file_path: supabasePath,
      file_url: publicUrl,
      duration
    }]);

  if (dbError) throw new Error(`DB insert failed: ${dbError.message}`);

  const stats = fs.statSync(outputPath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

  return {
    type,
    friendlyName,
    outputPath: publicUrl,
    sizeMB,
    duration,
    message: "Processing terminé et fichier uploadé sur Supabase"
  };
}
