// utils/processAudio.js
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import https from "https";
import http from "http";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET_NAME || "audio-files";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Supabase URL ou Service Role Key manquante !");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// --- Téléchargement ---
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

// --- Durée audio ---
function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration);
    });
  });
}

export async function processAudio(inputUrl, projectId, options = {}) {
  const type = options.type || "music";

  if (!["music", "podcast"].includes(type)) {
    throw new Error(`Type inconnu: ${type}`);
  }

  console.log(`🚀 Processing project ${projectId} (${type})`);

  const inputPath = `/tmp/input_${projectId}.mp3`;
  const baseName = path.basename(inputUrl).split("-").slice(1).join("-").replace(".mp3", "");
  const timestamp = Date.now();
  const outputFileName = `processed/${projectId}/${baseName}-${type}-v${timestamp}.mp3`;
  const outputPath = `/tmp/${outputFileName.split("/").pop()}`;

  // Télécharger input
  console.log("⬇️ Downloading input file...");
  await downloadFile(inputUrl, inputPath);

  // Traitement FFmpeg
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
    } else {
      command = command.audioFilters([
        "highpass=f=80",
        "lowpass=f=12000",
        "afftdn=nf=-25",
        "acompressor=threshold=-20dB:ratio=3:attack=10:release=200:makeup=5",
        "loudnorm=I=-16:LRA=7:TP=-1.5"
      ]);
    }

    command
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .save(outputPath);
  });

  const duration = await getAudioDuration(outputPath);
  const stats = fs.statSync(outputPath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

  // Upload vers Supabase
  console.log(`⬆️ Uploading: ${outputFileName}`);
  const fileData = fs.readFileSync(outputPath);

  const { error: uploadError } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(outputFileName, fileData, { upsert: false });

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${outputFileName}`;

  // Insérer dans masterings
  const { data: masteringRow, error: masteringError } = await supabase
    .from("masterings")
    .insert([{
      project_id: projectId,
      user_id: options.userId,
      type,
      version: options.version || 1,
      file_path: outputFileName,
      file_url: publicUrl,
      duration,
      size_mb: sizeMB,
      settings: options.settings || {}
    }])
    .select()
    .single();

  if (masteringError) throw new Error(`DB insert failed: ${masteringError.message}`);

  // Mettre à jour le projet avec le dernier fichier
  await supabase
    .from("projects")
    .update({
      processed_file_path: outputFileName,
      processed_file_url: publicUrl,
      duration,
      status: "completed"
    })
    .eq("id", projectId);

  return {
    type,
    outputUrl: publicUrl,
    sizeMB,
    duration,
    masteringId: masteringRow.id,
    message: "✅ Processing terminé et sauvegardé"
  };
}
