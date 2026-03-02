import { createClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/config/env";

let cachedClient: any = null;

export function getSupabaseAdminClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const env = getEnv();
  cachedClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
  return cachedClient;
}

export function resetSupabaseAdminClientForTests() {
  cachedClient = null;
}
