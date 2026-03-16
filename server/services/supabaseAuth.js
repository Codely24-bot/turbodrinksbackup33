import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  (process.env.SUPABASE_URL || "").trim() ||
  (process.env.SUPABASE_PROJECT_ID
    ? `https://${process.env.SUPABASE_PROJECT_ID}`.trim() + ".supabase.co"
    : "");
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const useSupabaseAuth = Boolean(supabaseUrl && supabaseKey);

const supabase = useSupabaseAuth
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    })
  : null;

export const verifySupabaseToken = async (token) => {
  if (!useSupabaseAuth || !token) {
    return null;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return null;
  }

  return data.user;
};

export const getSupabaseAdminProfile = async (token) => {
  const user = await verifySupabaseToken(token);
  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("admin_profiles")
    .select("owner_name,store_name,doc_id,email,created_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data
    ? { user, profile: data, confirmed: Boolean(user.email_confirmed_at) }
    : { user, profile: null, confirmed: Boolean(user.email_confirmed_at) };
};

export const isSupabaseAuthEnabled = () => useSupabaseAuth;
