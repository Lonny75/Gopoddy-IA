import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

export async function getAudioDuration(filePath) {
  const { stdout } = await execPromise(`ffprobe -i ${filePath} -show_entries format=duration -v quiet -of csv="p=0"`);
  return parseFloat(stdout);
}
