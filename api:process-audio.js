import express from "express";
import { processAudio } from "../utils/processAudio.js";

const router = express.Router();

router.post("/process-audio", async (req, res) => {
  try {
    const { inputUrl, projectId, userId, options } = req.body;

    if (!inputUrl || !projectId || !userId) {
      return res.status(400).json({ error: "Paramètres manquants" });
    }

    console.log("🎧 Requête process-audio:", { inputUrl, projectId, userId });

    const result = await processAudio(inputUrl, projectId, userId, options || {});

    return res.json({
      success: true,
      projectId,
      userId,
      ...result
    });
  } catch (err) {
    console.error("❌ Erreur process-audio:", err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

export default router;
