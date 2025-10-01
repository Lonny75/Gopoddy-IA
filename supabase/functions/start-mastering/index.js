// supabase/functions/start-mastering/index.js
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Variables d'environnement
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseKey = Deno.env.get("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3d212Z3Zlc2ttc3Vybnh1c3Z5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTQ2OTg4NSwiZXhwIjoyMDY3MDQ1ODg1fQ.msU-pSMzixT3fEVlnIL7tCh8nR0k17JOw9wPwnQIFgA"); // ⚠️ bien mettre la service role key
const boltApiUrl = Deno.env.get("BOLT_API_URL") || "https://gopoddy-ia.onrender.com";
const boltApiKey = Deno.env.get("BOLT_API_KEY");

const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { status: 405 });
    }

    const { projectId, userId, filePath, type } = await req.json();

    if (!projectId || !userId || !filePath || !type) {
      return new Response(JSON.stringify({ error: "Paramètres manquants" }), { status: 400 });
    }

    console.log("🎧 Lancement mastering pour:", { projectId, userId, filePath, type });

    // URL du fichier d'entrée (dans le sous-dossier input/)
    const inputUrl = `${supabaseUrl}/storage/v1/object/public/audio-files/${filePath}`;

    // Choisir le bon sous-dossier de sortie
    let outputFolder = "podcast-master";
    if (type === "music") outputFolder = "music-master";

    // 🔗 Appel API Bolt
    const boltRes = await fetch(`${boltApiUrl}/process-audio`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": boltApiKey,
      },
      body: JSON.stringify({
        inputUrl,
        projectId,
        userId,
        outputFolder, // <-- très important
      }),
    });

    if (!boltRes.ok) {
      const err = await boltRes.text();
      console.error("❌ Erreur Bolt API:", err);
      return new Response(JSON.stringify({ error: "Erreur API Bolt", details: err }), { status: 500 });
    }

    const { outputUrl, duration } = await boltRes.json();

    // 🗄️ Mise à jour dans Supabase
    const { error } = await supabase
      .from("projects")
      .update({
        status: "completed",
        processed_file_path: outputUrl,
        duration,
      })
      .eq("id", projectId)
      .eq("user_id", userId);

    if (error) {
      console.error("❌ Erreur update Supabase:", error);
      return new Response(JSON.stringify({ error: "Erreur mise à jour Supabase" }), { status: 500 });
    }

    return new Response(JSON.stringify({
      message: "Mastering terminé",
      outputUrl,
      duration,
    }), { status: 200 });

  } catch (err) {
    console.error("❌ Erreur Edge Function:", err);
    return new Response(JSON.stringify({ error: "Erreur interne", details: err.message }), { status: 500 });
  }
});
