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

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const client = url.startsWith("https") ? https : http;

    client
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          return reject(new Error(`Download failed with status ${response.statusCode}`));
        }
        response.pipe(file);
        file.on("finish", () => file.close(resolve));
      })
      .on("error", (err) => fs.unlink(dest, () => reject(err)));
  });
}

function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration);
    });
  });
}

function getFriendlyName(inputUrl) {
  const fileName = path.basename(inputUrl, path.extname(inputUrl));
  const parts = fileName.split("-");
  let base = parts.pop() || fileName;
  return base.replace(/_/g, " ").trim();
}

async function ensureProjectExists(projectId, userId) {
  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (error && error.code !== "PGRST116") throw error;

  if (!project) {
    const { error: insertError } = await supabase
      .from("projects")
      .insert([{ id: projectId, user_id: userId, name: "Projet audio", status: "processing" }]);
    if (insertError) throw insertError;
    console.log(`🆕 Projet créé automatiquement : ${projectId}`);
  }
}

export async function processAudio(inputUrl, projectId, userId, options = {}) {
  console.log(`🚀 Processing project ${projectId} for user ${userId}`);

  await ensureProjectExists(projectId, userId);

  const inputPath = `/tmp/input_${projectId}.mp3`;
  const friendlyName = getFriendlyName(inputUrl);
  const outputPath = `/tmp/${projectId}_NiceMasterPro.mp3`;
  const supabasePath = `music-master/${friendlyName}_NiceMasterPro.mp3`;

  console.log("⬇️ Downloading input file...");
  await downloadFile(inputUrl, inputPath);

  console.log("🎛️ Applying Nice Master Pro preset...");
  await new Promise((resolve, reject) => {
    ffmpeg(inputPath)
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
        "aformat=sample_fmts=s16:channel_layouts=stereo"
      ])
      .on("end", resolve)
      .on("error", reject)
      .save(outputPath);
  });

  const duration = await getAudioDuration(outputPath);

  const fileData = fs.readFileSync(outputPath);
  const { error: uploadError } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(supabasePath, fileData, { upsert: true });

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${supabasePath}`;
  const stats = fs.statSync(outputPath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

  await supabase.from("projects").update({
    processed_file_path: supabasePath,
    processed_file_url: publicUrl,
    duration,
    status: "completed"
  }).eq("id", projectId);

  console.log(`✅ Upload réussi: ${publicUrl}`);

  return {
    outputPath: publicUrl,
    duration,
    sizeMB
  };
}
