// supabase/functions/start-mastering/index.js

// Fonction Edge Supabase
export default async (req, res) => {
  try {
    // Lecture du body JSON
    const body = await req.json();

    console.log("📥 Reçu dans start-mastering:", body);

    // Vérification des champs obligatoires
    const { projectId, userId, inputUrl } = body;
    if (!projectId || !userId || !inputUrl) {
      return res.json(
        { error: "Champs manquants: projectId, userId et inputUrl requis." },
        { status: 400 }
      );
    }

    // ⚡ URL de ton API Bolt sur Render (remplace si besoin)
    const boltUrl = "https://ton-api-bolt.onrender.com/process-audio";

    // Envoi des données à l’API Bolt
    const boltRes = await fetch(boltUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        userId,
        inputUrl,
        options: body.options || {}, // ex: mastering, normalisation etc.
      }),
    });

    if (!boltRes.ok) {
      const errText = await boltRes.text();
      console.error("❌ Erreur Bolt:", errText);
      return res.json({ error: "Erreur côté API Bolt", details: errText }, { status: 500 });
    }

    // Réponse de l’API Bolt
    const result = await boltRes.json();

    console.log("✅ Réponse Bolt:", result);

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error("❌ Erreur dans start-mastering:", error);
    return res.json({ error: error.message }, { status: 500 });
  }
};
