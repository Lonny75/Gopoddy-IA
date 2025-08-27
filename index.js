import express from "express";
import { processAudio } from "./utils/processAudio.js";

const app = express();
const port = process.env.PORT || 3000;

// Middleware JSON
app.use(express.json());

// Route de test
app.get("/", (req, res) => {
  res.send("🚀 Bolt Processing API déployée sur Render !");
});

// Endpoint de traitement
app.post("/process-audio", async (req, res) => {
  try {
    const { inputUrl, projectId, userId, options } = req.body;

    if (!inputUrl || !projectId || !userId) {
      return res.status(400).json({
        success: false,
        error: "Paramètres manquants (inputUrl, projectId, userId)",
      });
    }

    // Appel du traitement
    const result = await processAudio(inputUrl, projectId, userId, options);

    res.json(result);
  } catch (err) {
    console.error("Erreur API :", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Lancer serveur
app.listen(port, () => {
  console.log(`⚡ Bolt Processing API démarrée sur port ${port}`);
});

