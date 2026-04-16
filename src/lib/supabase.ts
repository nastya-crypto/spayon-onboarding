import { createClient } from "@supabase/supabase-js";

// Server-side client with service role key — never expose to the browser
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
