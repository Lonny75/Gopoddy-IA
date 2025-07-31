const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { processAudio } = require('./processAudio');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// ✅ Middleware
app.use(cors({
  origin: '*', // Ou spécifie une liste : ['http://localhost:5173', 'https://gopoddy.vercel.app']
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// ✅ Route racine (test rapide)
app.get('/', (req, res) => {
  res.send('🎧 API Bolt Render est en ligne');
});

// ✅ Endpoint de santé / status
app.get('/api/status', (req, res) => {
  res.json({
    status: 'OK',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ✅ Endpoint principal pour le traitement audio
app.post('/api/process-audio', async (req, res) => {
  try {
    const { inputUrl, projectId, userId, options } = req.body;

    if (!inputUrl || !projectId || !userId) {
      return res.status(400).json({ error: 'Champs manquants' });
    }

    const result = await processAudio({ inputUrl, projectId, userId, options });
    res.status(200).json(result);
  } catch (error) {
    console.error('Erreur traitement audio:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// ✅ Lancement serveur
app.listen(port, () => {
  console.log(`🚀 Serveur Bolt API lancé sur le port ${port}`);
});
