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

// --- Téléchargement sans dépendances ---
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const client = url.startsWith("https") ? https : http;

    client
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          return reject(
            new Error(`Download failed with status ${response.statusCode}`)
          );
        }
        response.pipe(file);
        file.on("finish", () => file.close(resolve));
      })
      .on("error", (err) => fs.unlink(dest, () => reject(err)));
  });
}

// --- Obtenir durée audio via ffmpeg ---
function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration);
    });
  });
}

// --- Extraction nom "friendly" ---
function extractFriendlyName(urlOrPath) {
  const base = path.basename(urlOrPath, path.extname(urlOrPath));
  const parts = base.split("-");
  if (parts.length > 1) {
    return parts[1].replace(/_/g, " ");
  }
  return base;
}

// --- Traitement audio principal ---
export async function processAudio(inputUrl, projectId, userId, options = {}) {
  const type = options.type === "podcast" ? "podcast" : "music"; // ✅ safe type
  const friendlyName = extractFriendlyName(inputUrl);

  console.log(`🚀 Starting processing for project ${projectId}, user ${userId}`);
  console.log(`🎛️ Type: ${type}, FriendlyName: ${friendlyName}`);

  const inputPath = `/tmp/input_${projectId}.mp3`;
  const outputPath = `/tmp/output_${projectId}.mp3`;

  // --- Télécharger le fichier source ---
  console.log("⬇️ Downloading input file...");
  await downloadFile(inputUrl, inputPath);

  // --- Traitement FFmpeg ---
  console.log("🎚️ Processing with FFmpeg...");
  await new Promise((resolve, reject) => {
    let command = ffmpeg(inputPath).audioCodec("libmp3lame");

    if (type === "music") {
      command = command.audioFilters([
        "acompressor=threshold=-18dB:ratio=2:attack=20:release=250:makeup=7",
        "dynaudnorm=f=150:g=15",
        "equalizer=f=1000:t=q:w=1:g=3",
        "aformat=sample_fmts=s16:channel_layouts=stereo",
      ]);
    } else if (type === "podcast") {
      command = command.audioFilters([
        "highpass=f=80",
        "lowpass=f=12000",
        "afftdn=nf=-25",
        "acompressor=threshold=-20dB:ratio=3:attack=10:release=200:makeup=5",
        "loudnorm=I=-16:LRA=7:TP=-1.5",
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

  // --- Obtenir durée ---
  const duration = await getAudioDuration(outputPath);

  // --- Upload vers Supabase ---
  const timestamp = Date.now();
  const fileName = `processed/${projectId}/${friendlyName}_${type}_${timestamp}.mp3`;
  console.log(`⬆️ Uploading: ${fileName}`);
  const fileData = fs.readFileSync(outputPath);

  const { error: uploadError } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(fileName, fileData, { upsert: false });

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${fileName}`;

  // --- Taille du fichier ---
  const stats = fs.statSync(outputPath);
  const size = stats.size;

  // --- Insertion dans masterings ---
  const { error: insertError } = await supabase.from("masterings").insert({
    project_id: projectId,
    user_id: userId,
    type, // ✅ "music" ou "podcast"
    file_path: fileName,
    file_url: publicUrl,
    duration,
    size,
  });

  if (insertError) throw new Error(`DB insert failed: ${insertError.message}`);

  // --- Mise à jour du projet ---
  const { error: dbError } = await supabase
    .from("projects")
    .update({
      processed_file_path: fileName,
      processed_file_url: publicUrl,
      duration,
      status: "completed",
    })
    .eq("id", projectId);

  if (dbError) throw new Error(`DB update failed: ${dbError.message}`);

  return {
    type,
    outputUrl: publicUrl,
    sizeMB: (size / (1024 * 1024)).toFixed(2),
    duration,
    message: "Processing terminé et fichier uploadé sur Supabase",
  };
}
