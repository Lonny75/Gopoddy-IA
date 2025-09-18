// utils/processAudio.js
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";

// Télécharge le fichier source vers /tmp
async function downloadFile(url, dest) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Erreur téléchargement: ${response.statusText}`);
  const fileStream = fs.createWriteStream(dest);
  await new Promise((resolve, reject) => {
    response.body.pipe(fileStream);
    response.body.on("error", reject);
    fileStream.on("finish", resolve);
  });
}

// Fonction principale
export async function processAudio(inputUrl, projectId, userId, options = {}) {
  try {
    const preset = options.preset || "standard";
    if (!["standard", "medium", "advanced"].includes(preset)) {
      throw new Error(`Preset inconnu: ${preset}`);
    }

    console.log(`🎛️ Applying preset: ${preset}`);

    const inputPath = `/tmp/input_${projectId}.mp3`;
    const outputPath = `/tmp/output_${projectId}.mp3`;

    console.log("⬇️ Downloading input file...");
    await downloadFile(inputUrl, inputPath);

    console.log("🎚️ Processing audio with FFmpeg...");
    await new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath).audioCodec("libmp3lame");

      if (preset === "standard") {
        command.audioFilters("loudnorm");
      } else if (preset === "medium") {
        command.audioFilters([
          "loudnorm",
          "compand=attacks=0:decays=0:points=-80/-80|-20/-20|0/-10|20/-8"
        ]);
      } else if (preset === "advanced") {
        command.audioFilters([
          "loudnorm",
          "compand=attacks=0:decays=0:points=-80/-80|-20/-20|0/-10|20/-8",
          "highpass=f=200, lowpass=f=12000"
        ]);
      }

      command
        .on("end", () => {
          console.log("✅ Audio processed successfully");
          resolve();
        })
        .on("error", (err) => {
          console.error("❌ FFmpeg error:", err);
          reject(err);
        })
        .save(outputPath);
    });

    // Upload vers Supabase et mise à jour DB (à intégrer ici)
    // Ex : await uploadToSupabaseAndUpdateDB(outputPath, projectId, userId);

    return { preset, outputPath };
  } catch (err) {
    console.error("❌ Processing failed:", err);
    throw err;
  }
}
