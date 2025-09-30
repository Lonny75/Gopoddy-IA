// index.js
import express from "express";
import cors from "cors";
import { processAudio } from "./utils/processAudio.js";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Supabase URL ou Service Role Key manquante !");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// === Endpoint de test simple ===
app.get("/", (req, res) => {
  res.json({ message: "🚀 Bolt Processing API is running!" });
});

// === Endpoint principal de traitement audio ===
app.post("/process-audio", async (req, res) => {
  const { inputUrl, projectId, userId, options = {} } = req.body;

  if (!inputUrl || !projectId || !userId) {
    return res.status(400).json({ error: "Champs manquants: inputUrl, projectId, userId requis" });
  }

  try {
    // --- Créer une nouvelle tâche ---
    const { data: taskData, error: taskError } = await supabase
      .from("processing_tasks")
      .insert([
        {
          project_id: projectId,
          user_id: userId,
          status: "pending",
          input_url: inputUrl
        }
      ])
      .select("id")
      .single();

    if (taskError) throw taskError;

    const taskId = taskData.id;
    console.log(`🚀 Nouvelle tâche créée: ${taskId}`);

    // --- Lancer le traitement audio ---
    const result = await processAudio(inputUrl, projectId, userId, options);

    // --- Mettre à jour la tâche ---
    const { error: updateError } = await supabase
      .from("processing_tasks")
      .update({
        status: "completed",
        output_url: result.outputPath,
        duration: result.duration,
        size_mb: result.sizeMB
      })
      .eq("id", taskId);

    if (updateError) throw updateError;

    res.json({
      success: true,
      taskId,
      projectId,
      userId,
      result
    });
  } catch (err) {
    console.error("❌ Processing failed:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`⚡ Bolt Processing API running on port ${PORT}`);
});
