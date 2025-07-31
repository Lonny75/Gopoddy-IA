import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import processAudio from './processAudio.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS config
const allowedOrigins = [
  'http://localhost:5173',
  'https://gopoddy.vercel.app',
  'https://bolt.new',
  'https://gopoddy-ia-1.onrender.com',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS not allowed for this origin'));
  },
  credentials: true,
  methods: 'GET,POST,OPTIONS',
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// Routes de test
app.get('/', (req, res) => {
  res.send('✅ Bolt API est en ligne !');
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development',
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    endpoints: ['/process-audio'],
    version: '1.0.0',
    supabaseConnected: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
});

// Route principale de traitement
app.post('/process-audio', async (req, res) => {
  try {
    const { inputUrl, userId, projectId, options } = req.body;

    if (!inputUrl || !userId || !projectId) {
      return res.status(400).json({ error: 'Champs requis manquants.' });
    }

    const result = await processAudio({
      inputUrl,
      userId,
      projectId,
      options,
    });

    res.status(200).json(result);
  } catch (error) {
    console.error('Erreur /process-audio :', error);
    res.status(500).json({ error: 'Erreur interne serveur.' });
  }
});

// Lancer le serveur
app.listen(PORT, () => {
  console.log(`🚀 Bolt API en écoute sur http://localhost:${PORT}`);
});
