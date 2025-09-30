// index.js
import express from "express";
import cors from "cors";
import { processAudio } from "./utils/processAudio.js";

const app = express();
app.use(cors());
app.use(express.json());

// --- Port dynamique Render ou fallback ---
const PORT = process.env.PORT || 10000;

// --- Vérification variables d'environnement ---
console.log("SUPABASE_URL:", process.env.SUPABASE_URL || "MISSING");
console.log(
  "SUPABASE_SERVICE_ROLE_KEY:",
  process.env.SUPABASE_SERVICE_ROLE_KEY ? "✅ OK" : "❌ MISSING"
);
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Supabase URL ou Service Role Key manquante !");
  process.exit(1);
}

// --- Endpoint test racine ---
app.get("/", (req, res) => {
  res.json({ message: "🚀 Bolt Processing API is running!" });
});

// --- Endpoint santé ---
app.get("/api/status", (req, res) => {
  res.json({ status: "ok", message: "Bolt API en ligne ✅" });
});

// --- Endpoint principal de traitement audio ---
app.post("/api/process-audio", async (req, res) => {
  const { inputUrl, projectId, userId, options = {} } = req.body;

  if (!inputUrl || !projectId || !userId) {
    return res.status(400).json({
      error: "Champs manquants: inputUrl, projectId, userId requis",
    });
  }

  try {
    console.log(`🚀 Lancement mastering pour projet ${projectId}, user ${userId}`);

    // On force le preset "Nice Master Pro" pour tout le monde
    const result = await processAudio(inputUrl, projectId, userId, {
      type: "music",
    });

    // Réponse simplifiée pour ton front
    res.json({
      success: true,
      projectId,
      userId,
      outputUrl: result.outputPath,
      duration: result.duration,
      size: result.sizeMB,
      status: "completed",
      message: result.message,
    });
  } catch (err) {
    console.error("❌ Processing failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- Lancement serveur ---
app.listen(PORT, () => {
  console.log(`⚡ Bolt Processing API running on port ${PORT}`);
  console.log(`📡 Healthcheck: http://localhost:${PORT}/api/status`);
});
