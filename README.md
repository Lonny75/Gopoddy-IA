# Bolt Processing API

API de traitement audio pour GOPODDY IA 🚀

## 🚀 Installation

```bash
git clone <repo-url>
cd bolt-processing-api
npm install
```

## ▶️ Lancer en local

```bash
npm start
```

## 🌍 Routes disponibles

- `GET /api/status` → Vérifie que l'API fonctionne
- `POST /api/process-audio` → Lance un traitement audio

Exemple POST :
```json
{
  "inputUrl": "https://supabase.storage/audio/original.mp3",
  "projectId": "123",
  "userId": "456",
  "options": { "normalize": true }
}
```
