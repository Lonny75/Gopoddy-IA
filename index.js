// index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { processAudio } from './utils/processAudio.js';
import { getAudioDuration } from './utils/getAudioDuration.js';


dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Endpoint de santé
app.get("/", (req, res) => {
  res.send("✅ Bolt Processing API is running on Render!");
});

// Traitement audio
app.post("/process-audio", async (req, res) => {
  const { inputUrl, projectId, userId, options } = req.body;

  if (!inputUrl || !projectId || !userId) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  try {
    console.log(`🚀 Starting processing for project ${projectId}`);

    // Mettre à jour le statut en "processing"
    await supabase
      .from("projects")
      .update({ status: "processing" })
      .eq("id", projectId);

    // Lancer le traitement FFmpeg
    const processedFilePath = await processAudio(inputUrl, projectId, options);

    // Récupérer la durée
    const duration = await getAudioDuration(processedFilePath);

    // Générer URL publique
    const { data } = supabase.storage
      .from("audio-files")
      .getPublicUrl(processedFilePath);
    const outputUrl = data.publicUrl;

    // Mettre à jour en DB
    await supabase
      .from("projects")
      .update({
        status: "completed",
        processed_file_path: processedFilePath,
        processed_url: outputUrl,
        duration,
      })
      .eq("id", projectId);

    console.log(`✅ Processing completed for project ${projectId}`);

    res.json({
      projectId,
      outputUrl,
      duration,
      status: "completed",
    });
  } catch (err) {
    console.error("❌ Processing failed:", err);

    await supabase
      .from("projects")
      .update({ status: "failed" })
      .eq("id", projectId);

    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`⚡ Bolt Processing API running on port ${PORT}`);
});
