// index.js
import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import { processAudio } from "./utils/processAudio.js";

// ----------------------------------------
// 🧠 Variables d'environnement
// ----------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Erreur critique : variables d'environnement manquantes !");
  console.error("👉 Vérifie SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans Render.");
  process.exit(1);
}

// Initialisation du client Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ----------------------------------------
// 🚀 Initialisation du serveur
// ----------------------------------------
const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors({ origin: "*", methods: ["GET", "POST", "OPTIONS"] }));
app.use(express.json({ limit: "50mb" }));

console.log("✅ Bolt Processing API initialisée et en attente de connexions...");

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
// 🩺 Endpoints de diagnostic
// ----------------------------------------
app.get("/", (req, res) => res.json({ message: "🚀 Bolt Processing API is running!" }));
app.get("/api/status", (req, res) => res.json({ status: "ok", message: "Bolt API en ligne ✅" }));

// ----------------------------------------
// 🎧 Endpoint principal : traitement audio
// ----------------------------------------
app.post("/api/process-audio", async (req, res) => {
  const { inputUrl, projectId, userId, options = {} } = req.body;

  // 🧱 Vérification des paramètres
  if (!inputUrl || !projectId || !userId) {
    return res.status(400).json({
      success: false,
      error: "Champs manquants : inputUrl, projectId, userId requis",
    });
  }

  console.log(`📥 Traitement demandé pour le projet ${projectId} (utilisateur ${userId})`);

  try {
    // 🟢 Mise à jour initiale du statut
    await supabase.from("projects").update({ status: "processing" }).eq("id", projectId);
    console.log("⚙️ Statut du projet mis à jour : processing");

    // 🎛 Traitement audio
    const { outputUrl, duration, sizeMB } = await processAudio(inputUrl, projectId, userId, options);

    // ✅ Réponse finale (sans doublon de mise à jour Supabase)
    console.log(`✅ Fichier traité avec succès : ${outputUrl}`);

    return res.json({
      success: true,
      projectId,
      userId,
      outputUrl,
      duration,
      size: sizeMB,
      status: "completed",
    });
  } catch (err) {
    console.error("❌ Erreur lors du traitement audio :", err.message || err);

    // 🟥 Statut d’erreur dans Supabase
    await supabase.from("projects").update({ status: "failed" }).eq("id", projectId);

    return res.status(500).json({
      success: false,
      projectId,
      userId,
      error: err.message || "Erreur inconnue pendant le traitement audio.",
    });
  }
});

// ----------------------------------------
// 🚀 Lancement du serveur
// ----------------------------------------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`⚡ Bolt Processing API active sur le port ${PORT}`);
  console.log(`📡 Healthcheck: http://0.0.0.0:${PORT}/api/status`);
});
