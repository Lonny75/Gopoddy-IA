
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.uploadFile = async (filePath, destPath) => {
  const fileBuffer = fs.readFileSync(filePath);
  const { data, error } = await supabase.storage
    .from("audio-files")
    .upload(destPath, fileBuffer, { upsert: true, contentType: "audio/mpeg" });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from("audio-files")
    .getPublicUrl(destPath);

  return urlData.publicUrl;
};
