import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import { processAudio } from "./processAudio.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

const PORT = process.env.PORT || 3000;

// ✅ Route de test
app.get("/api/status", (req, res) => {
  res.json({ status: "ok", message: "Bolt Processing API fonctionne 🚀" });
});

// ✅ Traitement audio
app.post("/api/process-audio", async (req, res) => {
  try {
    const { inputUrl, projectId, userId, options } = req.body;

    if (!inputUrl) {
      return res.status(400).json({ error: "inputUrl manquant" });
    }

    const result = await processAudio(inputUrl, projectId, userId, options);

    res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error("Erreur /process-audio:", err);
    res.status(500).json({ error: "Erreur serveur", details: err.message });
  }
});

// ✅ Lancement serveur
app.listen(PORT, () => {
  console.log(`✅ Bolt Processing API démarrée sur le port ${PORT}`);
});
