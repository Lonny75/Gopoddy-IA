
const path = require("path");
const fs = require("fs/promises");
const { downloadFile } = require("./downloadFile");
const { uploadFile } = require("./uploadFile");
const { getAudioDuration } = require("./getAudioDuration");
const { updateSupabase } = require("./updateSupabase");

exports.processAudio = async ({ inputUrl, userId, projectId, options }) => {
  const tempInput = `input-${Date.now()}.mp3`;
  const tempOutput = `output-${Date.now()}.mp3`;

  await downloadFile(inputUrl, tempInput);

  const ffmpeg = require("fluent-ffmpeg");
  return new Promise((resolve, reject) => {
    let command = ffmpeg(tempInput);

    if (options?.normalize) {
      command.audioFilters("loudnorm");
    }
    if (options?.eq) {
      command.audioFilters("equalizer=f=1000:t=q:w=1:g=5");
    }
    if (options?.compress) {
      command.audioFilters("acompressor");
    }
    if (options?.denoise) {
      command.audioFilters("afftdn");
    }

    command
      .output(tempOutput)
      .on("end", async () => {
        const filePath = `processed/${userId}/${projectId}/output.mp3`;
        const publicUrl = await uploadFile(tempOutput, filePath);
        const duration = await getAudioDuration(tempOutput);
        await updateSupabase({ projectId, filePath, duration });
        await fs.unlink(tempInput);
        await fs.unlink(tempOutput);
        resolve({ outputUrl: publicUrl, duration });
      })
      .on("error", reject)
      .run();
  });
};
