// index.js
import express from "express";
import cors from "cors";
import { processAudio } from "./utils/processAudio.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

// --- Vérification des variables d'environnement ---
console.log("SUPABASE_URL:", process.env.SUPABASE_URL || "MISSING");
console.log("SUPABASE_SERVICE_ROLE_KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "OK" : "MISSING");

// --- Endpoint test ---
app.get("/", (req, res) => {
  res.json({ message: "🚀 Bolt Processing API is running!" });
});

// --- Endpoint principal de traitement audio ---
app.post("/process-audio", async (req, res) => {
  const { inputUrl, projectId, userId, options = {} } = req.body;

  if (!inputUrl || !projectId || !userId) {
    return res.status(400).json({ error: "Champs manquants: inputUrl, projectId, userId requis" });
  }

  try {
    console.log(`🚀 Starting processing for project ${projectId}, user ${userId}`);
    
    // --- On récupère le type via options.type ou preset ---
    const type = options.type || (options.preset === "podcast" ? "podcast" : "music");

    const result = await processAudio(inputUrl, projectId, userId, { type });

    res.json({
      success: true,
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
