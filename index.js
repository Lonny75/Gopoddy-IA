import express from "express";
import dotenv from "dotenv";
import { processAudio } from "./utils/processAudio.js"; // 👈 importer la bonne fonction
import pkg from "@supabase/supabase-js";

dotenv.config({ path: "_env" }); // bien préciser _env

const { createClient } = pkg;

const app = express();
app.use(express.json());

// connexion Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.post("/process-audio", async (req, res) => {
  const { inputUrl, projectId, userId, options } = req.body;

  if (!inputUrl || !projectId || !userId) {
    return res.status(400).json({ success: false, error: "Missing parameters" });
  }

  try {
    console.log("🔄 Start processing:", { inputUrl, projectId, userId, options });

    // Mise à jour du projet -> statut "processing"
    await supabase.from("projects").update({ status: "processing" }).eq("id", projectId);

    // Traitement audio
    const result = await processAudio({ inputUrl, projectId, userId, options });

    if (!result.success) throw new Error(result.error);

    // Mise à jour du projet -> statut "completed"
    await supabase.from("projects").update({
      status: "completed",
      processed_file_path: result.processedPath,
      processed_url: result.processedUrl
    }).eq("id", projectId);

    console.log("✅ Processing completed:", result.processedUrl);

    return res.json({
      success: true,
      outputUrl: result.processedUrl,
    });

  } catch (err) {
    console.error("❌ Processing failed:", err);

    await supabase.from("projects").update({ status: "failed" }).eq("id", projectId);

    return res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Bolt Processing API running on http://localhost:${PORT}`);
});
