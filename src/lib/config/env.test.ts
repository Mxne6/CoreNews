import { afterEach, describe, expect, it } from "vitest";
import { getEnv, resetEnvCacheForTests } from "@/lib/config/env";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  resetEnvCacheForTests();
});

describe("getEnv", () => {
  it("throws when required env is missing", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.CRON_SECRET = "cron-secret";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => getEnv()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("returns validated env values", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    process.env.CRON_SECRET = "cron-secret";

    const env = getEnv();
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://example.supabase.co");
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe("service-role-key");
    expect(env.CRON_SECRET).toBe("cron-secret");
  });
});
