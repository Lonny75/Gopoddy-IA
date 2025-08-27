# ⚡️ Bolt Processing API

API de traitement audio utilisée par **Gopoddy IA**, déployée sur **Render**.  
Elle permet de traiter des fichiers audio stockés dans **Supabase**, via **FFmpeg**, avec plusieurs fonctionnalités :

- 🎚️ Mastering (niveaux : standard, moyen, avancé)  
- ✂️ Découpage et suppression des silences  
- 🔊 Normalisation, compression, EQ  
- 📝 Transcription et résumé automatique  

---

## 🚀 Installation locale

```bash
# Cloner le repo
git clone https://github.com/TON-UTILISATEUR/bolt-processing-api.git
cd bolt-processing-api

# Installer les dépendances
npm install

# Lancer en développement
npm run dev
