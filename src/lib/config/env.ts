const requiredKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRON_SECRET",
] as const;

export type AppEnv = {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CRON_SECRET: string;
  DASHSCOPE_API_KEY?: string;
};

let cachedEnv: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  for (const key of requiredKeys) {
    if (!process.env[key] || process.env[key]?.trim().length === 0) {
      throw new Error(`Missing required env var: ${key}`);
    }
  }

  cachedEnv = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    CRON_SECRET: process.env.CRON_SECRET as string,
    DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY,
  };
  return cachedEnv;
}

export function resetEnvCacheForTests() {
  cachedEnv = null;
}

export function hasRequiredEnv(): boolean {
  if (process.env.VITEST === "true") {
    return false;
  }
  return requiredKeys.every((key) => Boolean(process.env[key] && process.env[key]?.trim().length));
}
