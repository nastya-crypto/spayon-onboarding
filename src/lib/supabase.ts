import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

// Lazy initialization — client is created on first call, not at import time.
// This avoids "supabaseUrl is required" errors during next build.
export function getSupabaseAdmin(): SupabaseClient {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env variables are required");
    }
    _client = createClient(url, key);
  }
  return _client;
}
