import { createClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/config/env";

function createSupabaseAdminClient() {
  const env = getEnv();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

let cachedClient: SupabaseAdminClient | null = null;

export function getSupabaseAdminClient() {
  if (cachedClient) {
    return cachedClient;
  }
  cachedClient = createSupabaseAdminClient();
  return cachedClient;
}

export function resetSupabaseAdminClientForTests() {
  cachedClient = null;
}
