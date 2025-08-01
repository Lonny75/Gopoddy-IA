
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.updateSupabase = async ({ projectId, filePath, duration }) => {
  const { error } = await supabase
    .from("projects")
    .update({
      processed_file_path: filePath,
      duration: duration,
      status: "completed",
    })
    .eq("id", projectId);

  if (error) throw error;
};
