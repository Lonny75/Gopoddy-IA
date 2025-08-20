# Gopoddy-IA-1 API

API Node.js déployée sur Render pour traiter les fichiers audio avec Supabase et FFmpeg.

## 🚀 Installation locale
```bash
npm install
npm start
```

## ⚙️ Variables d'environnement
- `SUPABASE_URL` : URL de ton projet Supabase
- `SUPABASE_SERVICE_ROLE_KEY` : Service Role Key de Supabase (⚠️ ne pas utiliser la anon key)

## 📡 Endpoints
- `GET /test-env` → Vérifie que la clé est bien chargée
- `POST /api/process-audio` → Lance un traitement audio
