// index.js - API Bolt (Render)
import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { processAudio } from "./utils/processAudio.js";

dotenv.config();

const app = express();
app.use(bodyParser.json());

// 🔹 Init Supabase avec la Service Role Key (Render > Environment Variables)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============= ROUTES =============

// 1️⃣ Créer une tâche
app.post("/create-task", async (req, res) => {
  try {
    const { projectId, userId, preset } = req.body;

    if (!projectId || !userId) {
      return res.status(400).json({ error: "projectId et userId requis" });
    }

    const { data, error } = await supabase
      .from("processing_tasks")
      .insert([
        {
          project_id: projectId,
          user_id: userId,
          preset,
          status: "pending",
        },
      ])
      .select()
      .single();

    if (error) throw error;

    res.json({ task: data });
  } catch (err) {
    console.error("Erreur /create-task:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// 2️⃣ Traiter une tâche existante
app.post("/process-audio", async (req, res) => {
  try {
    const { taskId } = req.body;
    if (!taskId) {
      return res.status(400).json({ error: "taskId manquant" });
    }

    // Récupérer la tâche
    const { data: task, error: taskError } = await supabase
      .from("processing_tasks")
      .select("id, project_id, preset, projects(file_path)")
      .eq("id", taskId)
      .single();

    if (taskError || !task) {
      return res.status(404).json({ error: "Impossible de trouver la tâche processing_tasks" });
    }

    const inputPath = task.projects?.file_path;
    if (!inputPath) {
      return res.status(400).json({ error: "file_path introuvable dans le projet" });
    }

    // Mettre la tâche en processing
    await supabase
      .from("processing_tasks")
      .update({ status: "processing" })
      .eq("id", taskId);

    // Lancer le traitement FFmpeg
    const { outputUrl, duration } = await processAudio({
      inputPath,
      preset: task.preset,
      projectId: task.project_id,
    });

    // Mettre à jour la DB
    await supabase
      .from("processing_tasks")
      .update({ status: "completed" })
      .eq("id", taskId);

    await supabase
      .from("projects")
      .update({
        status: "completed",
        processed_file_path: outputUrl,
        duration,
      })
      .eq("id", task.project_id);

    res.json({ success: true, outputUrl, duration });
  } catch (err) {
    console.error("Erreur /process-audio:", err.message);

    // Marquer la tâche en failed
    if (req.body.taskId) {
      await supabase
        .from("processing_tasks")
        .update({ status: "failed" })
        .eq("id", req.body.taskId);
    }

    res.status(500).json({ error: err.message });
  }
});

// =================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Bolt API en écoute sur le port ${PORT}`);
});
