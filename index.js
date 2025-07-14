const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { supabase } = require('./supabaseClient');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Exemple route de test
app.get('/', (req, res) => {
  res.send('Bolt Processing API is live 🔥');
});

// Route de traitement audio (simplifiée pour debug)
app.post('/process-audio', async (req, res) => {
  const { inputUrl, options } = req.body;

  if (!inputUrl) {
    return res.status(400).json({ error: 'inputUrl manquant' });
  }

  try {
    ffmpeg.setFfmpegPath(ffmpegPath);

    // Exemple de traitement fictif (juste pour montrer la structure)
    console.log('Traitement en cours pour:', inputUrl);

    // Ici tu implémenteras le vrai traitement avec download, ffmpeg, upload

    return res.status(200).json({
      success: true,
      outputUrl: 'https://.../fichier-traité.mp3',
      duration: 123
    });
  } catch (err) {
    console.error('Erreur:', err);
    return res.status(500).json({ error: 'Erreur traitement audio', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Bolt Processing API lancé sur http://localhost:${PORT}`);
});
