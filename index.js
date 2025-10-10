// index.js
import express from "express";
import cors from "cors";
import { processAudio } from "./utils/processAudio.js";

// ----------------------------------------
// ✅ Initialisation
// ----------------------------------------
console.log("✅ Bolt API démarrée et en écoute...");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors({
  origin: "*", // (tu pourras restreindre à ton domaine Supabase plus tard)
  methods: ["GET", "POST", "OPTIONS"],
}));
app.use(express.json({ limit: "50mb" }));

// ----------------------------------------
// 🧩 Middleware de log pour diagnostic
// ----------------------------------------
app.use((req, res, next) => {
  console.log("--------------------------------------------------");
  console.log(`📡 ${req.method} ${req.url}`);
  console.log(`🔹 Origine : ${req.get("Origin") || "inconnue"}`);
  console.log(`🔹 Heure : ${new Date().toISOString()}`);
  if (["POST", "PUT"].includes(req.method)) {
    console.log("🔹 Corps (tronqué) :", JSON.stringify(req.body).substring(0, 400));
  }
  console.log("--------------------------------------------------");
  next();
});

// ----------------------------------------
// 🔐 Logs d'environnement (pour débogage Render)
// ----------------------------------------
console.log("SUPABASE_URL:", process.env.SUPABASE_URL || "❌ MISSING");
console.log("SUPABASE_SERVICE_ROLE_KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "✅ OK" : "❌ MISSING");

// ----------------------------------------
// 🩺 Endpoint racine et santé
// ----------------------------------------
app.get("/", (req, res) => {
  res.json({ message: "🚀 Bolt Processing API is running!" });
});

app.get("/api/status", (req, res) => {
  res.json({ status: "ok", message: "Bolt API en ligne ✅" });
});

// ----------------------------------------
// 🎧 Endpoint principal : traitement audio
// ----------------------------------------
app.post("/api/process-audio", async (req, res) => {
  const { inputUrl, projectId, userId, options = {} } = req.body;

  // Vérification des paramètres
  if (!inputUrl || !projectId || !userId) {
    return res.status(400).json({
      success: false,
      error: "Champs manquants : inputUrl, projectId, userId requis",
    });
  }

  console.log(`📥 Traitement demandé : projectId=${projectId}, userId=${userId}`);

  try {
    // Déterminer le type de traitement
    const type = options.type === "podcast" ? "podcast" : "music";
    console.log(`🎚 Type de traitement : ${type}`);

    // Traitement audio via utilitaire
    const result = await processAudio(inputUrl, projectId, userId, { type });

    console.log("✅ Traitement terminé avec succès :", result);

    // Retour au client
    return res.json({
      success: true,
      projectId,
      userId,
      type,
      outputUrl: result.outputPath,
      duration: result.duration,
      size: result.sizeMB,
      status: "completed",
    });
  } catch (err) {
    console.error("❌ Erreur lors du traitement audio :", err);
    return res.status(500).json({
      success: false,
      projectId,
      userId,
      error: err.message || "Erreur inconnue",
    });
  }
});

// ----------------------------------------
// 🚀 Lancement du serveur sur Render
// ----------------------------------------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`⚡ Bolt Processing API running on port ${PORT}`);
  console.log(`📡 Healthcheck: http://0.0.0.0:${PORT}/api/status`);
});
