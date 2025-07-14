const express = require('express');
const cors = require('cors');
const ffmpegProcess = require('./ffmpegUtils');
const supabase = require('./supabaseClient');
const fs = require('fs');
const path = require('path');
const app = express();
app.use(cors());
app.use(express.json());

app.post('/process-audio', async (req, res) => {
  const { projectId, inputUrl, options } = req.body;

  if (!projectId || !inputUrl) {
    return res.status(400).json({ success: false, error: 'projectId et inputUrl sont requis' });
  }

  try {
    console.log('🔧 Traitement démarré pour', projectId);

    // Télécharger le fichier temporairement
    const inputPath = path.join(__dirname, `input_${projectId}.mp3`);
    const outputPath = path.join(__dirname, `output_${projectId}.mp3`);
    const writer = fs.createWriteStream(inputPath);

    const response = await fetch(inputUrl);
    if (!response.ok) throw new Error('Téléchargement échoué');
    await new Promise((resolve, reject) => {
      response.body.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    // Traiter avec FFmpeg
    await ffmpegProcess(inputPath, outputPath, options);

    // Uploader dans Supabase Storage
    const fileBuffer = fs.readFileSync(outputPath);
    const fileName = `processed_${Date.now()}.mp3`;
    const { data, error } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET_NAME || 'audio-files')
      .upload(fileName, fileBuffer, { contentType: 'audio/mpeg', upsert: true });

    if (error) throw error;

    // Nettoyage
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);

    res.json({
      success: true,
      outputPath: fileName,
      duration: null, // optionnel
      message: 'Traitement terminé avec succès',
    });
  } catch (err) {
    console.error('❌ Erreur traitement :', err);
    res.status(500).json({ success: false, error: 'Erreur traitement audio', details: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
});