import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { processAudio } from "./utils/processAudio.js";

const app = express();
const port = process.env.PORT || 3000;

// Gestion des chemins
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware pour parsing JSON
app.use(express.json());

// Config Multer (upload fichiers temporaires)
const upload = multer({ dest: "uploads/" });

// Route test
app.get("/", (req, res) => {
  res.send("🚀 Bolt Processing API fonctionne !");
});

// Endpoint de traitement audio
app.post("/process-audio", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "Aucun fichier reçu" });
    }

    const inputPath = req.file.path;
    const outputPath = path.join("processed", `${Date.now()}-processed.mp3`);

    // Vérifie que le dossier existe
    fs.mkdirSync("processed", { recursive: true });

    // Lancer traitement
    const result = await processAudio(inputPath, outputPath, {});

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json({
      success: true,
      message: "Traitement terminé ✅",
      outputFile: outputPath,
    });
  } catch (err) {
    console.error("Erreur API :", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Lancer serveur
app.listen(port, () => {
  console.log(`⚡ Bolt Processing API démarrée sur http://localhost:${port}`);
});
