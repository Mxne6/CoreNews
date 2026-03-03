#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const REQUIRED_TABLES = [
  "sources",
  "articles",
  "events",
  "event_articles",
  "summaries",
  "snapshots",
  "pipeline_runs",
];

const SEED_SOURCES = [
  {
    name: "Reuters World",
    rss_url: "https://feeds.reuters.com/reuters/worldNews",
    authority_weight: 1.2,
    category: "international",
    is_active: true,
  },
  {
    name: "BBC World",
    rss_url: "http://feeds.bbci.co.uk/news/world/rss.xml",
    authority_weight: 1.1,
    category: "international",
    is_active: true,
  },
  {
    name: "NHK",
    rss_url: "https://www3.nhk.or.jp/rss/news/cat0.xml",
    authority_weight: 1.1,
    category: "international",
    is_active: true,
  },
  {
    name: "TechCrunch",
    rss_url: "https://techcrunch.com/feed/",
    authority_weight: 1.0,
    category: "tech",
    is_active: true,
  },
];

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { triggerUrl: null };
  for (const arg of args) {
    if (arg.startsWith("--trigger-url=")) {
      result.triggerUrl = arg.slice("--trigger-url=".length).trim();
    }
  }
  return result;
}

function loadDotEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    return;
  }
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/g)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const sep = trimmed.indexOf("=");
    if (sep <= 0) {
      continue;
    }
    const key = trimmed.slice(0, sep);
    const value = trimmed.slice(sep + 1);
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function checkTableExists(client, table) {
  const { error } = await client.from(table).select("*", { head: true, count: "exact" });
  if (!error) {
    return true;
  }
  if (error.message.includes("Could not find the table")) {
    return false;
  }
  throw new Error(`${table}: ${error.message}`);
}

async function ensureSeedSources(client) {
  const { error } = await client.from("sources").upsert(SEED_SOURCES, { onConflict: "rss_url" });
  if (error) {
    throw new Error(`seed_sources_failed: ${error.message}`);
  }
}

async function triggerPipelineIfRequested(triggerUrl) {
  if (!triggerUrl) {
    return null;
  }
  if (!process.env.CRON_SECRET) {
    throw new Error("CRON_SECRET is missing; cannot trigger cron endpoint.");
  }
  const response = await fetch(triggerUrl, {
    method: "GET",
    headers: {
      "x-cron-secret": process.env.CRON_SECRET,
    },
  });
  const bodyText = await response.text();
  return {
    status: response.status,
    bodyText,
  };
}

async function fetchPipelineHealth(client) {
  const { data, error } = await client
    .from("pipeline_runs")
    .select("id,status,started_at,ended_at,error,article_count,event_count,summary_count")
    .order("started_at", { ascending: false })
    .limit(5);
  if (error) {
    throw new Error(`load_pipeline_runs_failed: ${error.message}`);
  }
  const latest = data?.[0] ?? null;
  return {
    latest,
    runs: data ?? [],
  };
}

async function main() {
  loadDotEnvLocal();
  const { triggerUrl } = parseArgs();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.");
  }

  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const missingTables = [];
  for (const table of REQUIRED_TABLES) {
    const exists = await checkTableExists(client, table);
    if (!exists) {
      missingTables.push(table);
    }
  }

  if (missingTables.length > 0) {
    console.error("Missing tables in Supabase:", missingTables.join(", "));
    console.error("Run these SQL files in Supabase SQL Editor, then re-run this script:");
    console.error(" - supabase/migrations/2026030201_core_news_schema.sql");
    console.error(" - supabase/migrations/2026030202_pipeline_stability.sql");
    process.exitCode = 1;
    return;
  }

  await ensureSeedSources(client);
  console.log("Seeded/updated source rows.");

  const triggerResult = await triggerPipelineIfRequested(triggerUrl);
  if (triggerResult) {
    console.log("Triggered cron endpoint:", triggerUrl);
    console.log("Trigger status:", triggerResult.status);
    console.log("Trigger body:", triggerResult.bodyText.slice(0, 600));
  }

  const health = await fetchPipelineHealth(client);
  console.log("Latest pipeline run:", JSON.stringify(health.latest, null, 2));

  if (!health.latest) {
    console.warn("No pipeline run found yet. Trigger the endpoint once and rerun this script.");
    process.exitCode = 1;
    return;
  }

  if (health.latest.status !== "success") {
    console.error("Latest pipeline run is not success.");
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
