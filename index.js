// index.js
console.log("✅ Bolt API démarrée et en écoute...");
import express from "express";
import cors from "cors";
import { processAudio } from "./utils/processAudio.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

// Logs pour debug variables d'environnement
console.log("SUPABASE_URL:", process.env.SUPABASE_URL || "MISSING");
console.log("SUPABASE_SERVICE_ROLE_KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "OK" : "MISSING");

// Endpoint racine
app.get("/", (req, res) => {
  res.json({ message: "🚀 Bolt Processing API is running!" });
});

// Endpoint santé
app.get("/api/status", (req, res) => {
  res.json({ status: "ok", message: "Bolt API en ligne ✅" });
});

// Endpoint principal de traitement audio
app.post("/api/process-audio", async (req, res) => {
  const { inputUrl, projectId, userId, options = {} } = req.body;

  // Vérification des paramètres
  if (!inputUrl || !projectId || !userId) {
    return res.status(400).json({
      success: false,
      error: "Champs manquants : inputUrl, projectId, userId requis"
    });
  }

  console.log(`📥 Requête process-audio : projectId=${projectId}, userId=${userId}`);

  try {
    // Déterminer le type par défaut
    const type = options.type === "podcast" ? "podcast" : "music";

    console.log(`🚀 Lancement du traitement audio (${type}) pour projet ${projectId}`);

    // Appel à la fonction processAudio
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
    return res.status(500).json({
      success: false,
      projectId,
      userId,
      error: err.message || "Erreur inconnue"
    });
  }
});

app.listen(PORT, () => {
  console.log(`⚡ Bolt Processing API running on port ${PORT}`);
  console.log(`📡 Healthcheck: http://localhost:${PORT}/api/status`);
});
