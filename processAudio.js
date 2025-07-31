const { createClient } = require('@supabase/supabase-js');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Initialise Supabase (variables d'environnement requises)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Fonction principale
async function processAudio({ inputUrl, projectId, userId, options }) {
  const tempInputPath = `/tmp/input-${uuidv4()}.mp3`;
  const tempOutputPath = `/tmp/output-${uuidv4()}.mp3`;

  // 1. Télécharge le fichier depuis Supabase
  const response = await axios.get(inputUrl, { responseType: 'stream' });
  const input = fs.createWriteStream(tempInputPath);
  response.data.pipe(input);

  await new Promise((resolve, reject) => {
    input.on('finish', resolve);
    input.on('error', reject);
  });

  // 2. Traitement audio avec FFmpeg (exemple simple)
  await new Promise((resolve, reject) => {
    ffmpeg(tempInputPath)
      .audioCodec('libmp3lame')
      .audioBitrate(192)
      .on('end', resolve)
      .on('error', reject)
      .save(tempOutputPath);
  });

  // 3. Envoie dans Supabase Storage
  const outputBuffer = fs.readFileSync(tempOutputPath);
  const processedFileName = `processed/${uuidv4()}.mp3`;

  const { error: uploadError } = await supabase.storage
    .from('audio-files')
    .upload(processedFileName, outputBuffer, {
      contentType: 'audio/mpeg',
      upsert: true,
    });

  if (uploadError) throw uploadError;

  // 4. Récupère l’URL publique
  const { data: publicUrlData } = supabase.storage
    .from('audio-files')
    .getPublicUrl(processedFileName);

  const outputUrl = publicUrlData.publicUrl;

  // 5. Met à jour le projet dans Supabase
  const { error: updateError } = await supabase
    .from('projects')
    .update({
      status: 'completed',
      processed_file_path: processedFileName,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId);

  if (updateError) throw updateError;

  // Nettoyage des fichiers temporaires
  fs.unlinkSync(tempInputPath);
  fs.unlinkSync(tempOutputPath);

  return {
    success: true,
    outputUrl,
    processedFilePath: processedFileName,
  };
}

module.exports = { processAudio };
