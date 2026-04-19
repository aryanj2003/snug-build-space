import { supabase } from "@/integrations/supabase/client";

const PUBLIC_SUPABASE_URL = "https://bukrbymcyxhrergldglw.supabase.co";
const PUBLIC_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1a3JieW1jeXhocmVyZ2xkZ2x3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NjUyODAsImV4cCI6MjA5MjE0MTI4MH0.eDkCeSTEdHq95lVPfxvFUIruGASwhR27j97qhLfnFg8";

type BrowserProcessEnv = {
  process?: {
    env?: Record<string, string | undefined>;
  };
};

function ensureSupabaseBrowserEnv() {
  if (typeof window === "undefined") return;

  const browserGlobal = globalThis as typeof globalThis & BrowserProcessEnv;
  browserGlobal.process ??= {};
  browserGlobal.process.env ??= {};
  browserGlobal.process.env.SUPABASE_URL ??= PUBLIC_SUPABASE_URL;
  browserGlobal.process.env.SUPABASE_PUBLISHABLE_KEY ??= PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  browserGlobal.process.env.VITE_SUPABASE_URL ??= PUBLIC_SUPABASE_URL;
  browserGlobal.process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??= PUBLIC_SUPABASE_PUBLISHABLE_KEY;
}

export async function ensureAnonymousSession() {
  ensureSupabaseBrowserEnv();

  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;
  const { data: signed, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return signed.session;
}
