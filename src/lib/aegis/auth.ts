import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

const PUBLIC_SUPABASE_URL = "https://bukrbymcyxhrergldglw.supabase.co";
const PUBLIC_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1a3JieW1jeXhocmVyZ2xkZ2x3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NjUyODAsImV4cCI6MjA5MjE0MTI4MH0.eDkCeSTEdHq95lVPfxvFUIruGASwhR27j97qhLfnFg8";

const anonymousAuthClient = createClient<Database>(
  PUBLIC_SUPABASE_URL,
  PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: typeof window !== "undefined" ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);

export async function ensureAnonymousSession() {
  const { data } = await anonymousAuthClient.auth.getSession();
  if (data.session) return data.session;

  const { data: signed, error } = await anonymousAuthClient.auth.signInAnonymously();
  if (error) throw error;
  return signed.session;
}
