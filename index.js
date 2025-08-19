import express from "express";
import processAudio from "./processAudio.js";

const app = express();
app.use(express.json());

// 🔹 Route test pour vérifier que Render lit bien la clé Supabase
app.get("/test-env", (req, res) => {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    res.json({ status: "ok", keyLength: process.env.SUPABASE_SERVICE_ROLE_KEY.length });
  } else {
    res.json({ status: "missing" });
  }
});

// 🔹 Endpoint test process-audio
app.post("/api/process-audio", async (req, res) => {
  try {
    const result = await processAudio(req.body);
    res.json(result);
  } catch (err) {
    console.error("Erreur process-audio:", err);
    res.status(500).json({ error: "Processing failed" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
