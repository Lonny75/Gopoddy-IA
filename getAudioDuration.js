
const ffprobe = require("ffprobe");
const ffprobeStatic = require("ffprobe-static");

exports.getAudioDuration = async (filePath) => {
  const info = await ffprobe(filePath, { path: ffprobeStatic.path });
  const duration = info.streams[0].duration;
  return Math.round(Number(duration));
};
