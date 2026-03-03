import fs from "node:fs";
import path from "node:path";

export function parseArgs(argv) {
  const parsed = {
    baseUrl: "http://localhost:3000",
    secret: undefined,
    help: false,
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (arg.startsWith("--url=")) {
      parsed.baseUrl = arg.slice("--url=".length).trim();
      continue;
    }
    if (arg.startsWith("--secret=")) {
      parsed.secret = arg.slice("--secret=".length).trim();
      continue;
    }
  }

  return parsed;
}

export function normalizeBaseUrl(baseUrl) {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    throw new Error("base_url_empty");
  }
  return trimmed.replace(/\/+$/g, "");
}

export function buildEndpointUrl(baseUrl, endpointPath) {
  return `${normalizeBaseUrl(baseUrl)}${endpointPath}`;
}

export function buildAuthHeaders(secret) {
  const normalized = secret.trim();
  return {
    Authorization: `Bearer ${normalized}`,
    "x-cron-secret": normalized,
  };
}

export function didRunSucceedAfterRequestedAt(latestRun, requestedAtIso) {
  if (!latestRun || latestRun.status !== "success") {
    return false;
  }
  const runStartedAt = new Date(latestRun.startedAt ?? 0).getTime();
  const requestedAt = new Date(requestedAtIso).getTime();
  if (Number.isNaN(runStartedAt) || Number.isNaN(requestedAt)) {
    return false;
  }
  return runStartedAt >= requestedAt;
}

function parseDotEnvContent(content) {
  for (const line of content.split(/\r?\n/g)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

export function loadDotEnvLocal(cwd = process.cwd()) {
  const envPath = path.resolve(cwd, ".env.local");
  if (!fs.existsSync(envPath)) {
    return false;
  }
  parseDotEnvContent(fs.readFileSync(envPath, "utf8"));
  return true;
}

async function fetchJsonOrText(url, init = {}) {
  try {
    const response = await fetch(url, init);
    const raw = await response.text();
    let body = raw;
    try {
      body = JSON.parse(raw);
    } catch {
      // Keep raw text body.
    }
    return {
      ok: response.ok,
      status: response.status,
      body,
      networkError: null,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      body: "",
      networkError: (error).message,
    };
  }
}

export async function runDailyNow(options = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? "http://localhost:3000");
  const secret = (options.secret ?? process.env.CRON_SECRET ?? "").trim();
  if (!secret) {
    throw new Error("missing_cron_secret");
  }
  const requestedAtIso = new Date().toISOString();

  const triggerUrl = buildEndpointUrl(baseUrl, "/api/cron/daily");
  const healthUrl = buildEndpointUrl(baseUrl, "/api/health/pipeline");
  const homeUrl = buildEndpointUrl(baseUrl, "/api/home");

  const trigger = await fetchJsonOrText(triggerUrl, {
    method: "GET",
    headers: buildAuthHeaders(secret),
  });

  const health = await fetchJsonOrText(healthUrl);
  const home = await fetchJsonOrText(homeUrl);
  const latestRun =
    (Array.isArray(health.body?.runs) ? health.body.runs[0] : null) ??
    health.body?.latest ??
    null;
  const effectiveSuccess = didRunSucceedAfterRequestedAt(latestRun, requestedAtIso);

  return {
    baseUrl,
    requestedAtIso,
    trigger,
    health,
    home,
    latestRun,
    effectiveSuccess,
  };
}
