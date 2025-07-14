# Bolt Processing API

API de traitement audio avec FFmpeg pour Bolt IA.

## 🚀 Déploiement sur Render

1. Crée un repo GitHub avec ces fichiers
2. Va sur https://render.com
3. "New Web Service" > Connecte ton repo
4. Choisis Node.js (Auto-detect)
5. Configure les variables d'environnement :
   - SUPABASE_URL
   - SUPABASE_SERVICE_ROLE_KEY
   - SUPABASE_BUCKET_NAME=audio-files
6. Clique "Deploy"

Tu auras une URL comme : `https://bolt-processing.onrender.com/process-audio`