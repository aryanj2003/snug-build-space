import { publicSupabase } from "./publicSupabase";

export async function ensureAnonymousSession() {
  const { data } = await publicSupabase.auth.getSession();
  if (data.session) return data.session;

  const { data: signed, error } = await publicSupabase.auth.signInAnonymously();
  if (error) throw error;
  return signed.session;
}
