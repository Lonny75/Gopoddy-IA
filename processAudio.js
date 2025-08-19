// 🔹 Simulation du traitement audio (sans FFmpeg pour l'instant)
export default async function processAudio(body) {
  console.log("Requête reçue:", body);
  return {
    message: "Traitement audio simulé ✅",
    received: body,
    outputUrl: "https://example.com/output.mp3",
    duration: 120
  };
}
