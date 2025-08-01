
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();

const { processAudio } = require("./processAudio");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/status", (req, res) => {
  res.json({ status: "OK", message: "Bolt Processing API is running ✅" });
});

app.post("/api/process-audio", async (req, res) => {
  const { inputUrl, userId, projectId, options } = req.body;

  if (!inputUrl || !userId || !projectId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const result = await processAudio({ inputUrl, userId, projectId, options });
    res.status(200).json(result);
  } catch (error) {
    console.error("Processing error:", error);
    res.status(500).json({ error: error.message || "Processing failed" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Bolt Processing API running on port ${PORT}`);
});
