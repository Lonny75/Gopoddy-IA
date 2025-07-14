const { exec } = require('child_process');

module.exports = function processAudio(inputPath, outputPath, options = {}) {
  return new Promise((resolve, reject) => {
    let cmd = `ffmpeg -y -i "${inputPath}"`;

    if (options.normalize) cmd += ' -af "dynaudnorm"';
    if (options.eq) cmd += ' -af "equalizer=f=1000:width_type=o:width=2:g=5"';
    if (options.compression) cmd += ' -af "acompressor=threshold=-10dB:ratio=4"';
    if (options.denoise) cmd += ' -af "afftdn=nf=-25"';

    cmd += ` "${outputPath}"`;
    console.log('🎛️ Commande FFmpeg:', cmd);

    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error('FFmpeg error:', stderr);
        return reject(error);
      }
      resolve();
    });
  });
};