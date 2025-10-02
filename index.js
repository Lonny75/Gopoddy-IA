import express from "express";
import cors from "cors";
import { processAudio } from "./utils/processAudio.js";
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

// Supabase client avec service_role pour vérifications sécurisées
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.get("/", (req, res) => res.json({ message: "🚀 Bolt Processing API is running!" }));
app.get("/api/status", (req, res) => res.json({ status: "ok", message: "Bolt API en ligne ✅" }));

app.post("/api/process-audio", async (req, res) => {
  const { inputUrl, projectId, userId, options = {} } = req.body;

  if (!inputUrl || !projectId || !userId) {
    return res.status(400).json({ success: false, error: "Champs manquants : inputUrl, projectId, userId requis" });
  }

  console.log(`📥 Requête process-audio : projectId=${projectId}, userId=${userId}`);

  try {
    // Vérifier que le projet existe et appartient bien à cet utilisateur
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", userId)
      .single();

    if (projectError || !project) {
      throw new Error("Projet introuvable ou non autorisé pour cet utilisateur");
    }

    // Vérifier que l'inputUrl est accessible
    const response = await fetch(inputUrl, { method: "HEAD" });
    if (!response.ok) {
      throw new Error("Impossible d'accéder à l'inputUrl fourni");
    }

    const type = options.type === "podcast" ? "podcast" : "music";
    console.log(`🚀 Lancement du traitement audio (${type}) pour projet ${projectId}`);

    const result = await processAudio(inputUrl, projectId, userId, { type });

    console.log("✅ Traitement terminé :", result);

    return res.json({
      success: true,
      projectId,
      userId,
      type,
      outputUrl: result.outputPath,
      duration: result.duration,
      size: result.sizeMB,
      status: "completed"
    });

  } catch (err) {
    console.error("❌ Erreur lors du traitement audio :", err);
    return res.status(500).json({ success: false, projectId, userId, error: err.message || "Erreur inconnue" });
  }
});

app.listen(PORT, () => {
  console.log(`⚡ Bolt Processing API running on port ${PORT}`);
  console.log(`📡 Healthcheck: http://localhost:${PORT}/api/status`);
});
