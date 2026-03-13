#!/usr/bin/env node
import { loadDotEnvLocal, parseArgs, runDailyNow } from "./run-daily-now-lib.mjs";

function printUsage() {
  console.log("Usage: npm run run:daily -- [--url=<base-url>] [--secret=<cron-secret>]");
  console.log("Examples:");
  console.log("  npm run run:daily");
  console.log("  npm run run:daily -- --url=https://your-domain.vercel.app");
  console.log("  npm run run:daily -- --url=https://your-domain.vercel.app --secret=xxx");
}

function stringify(body) {
  if (typeof body === "string") {
    return body;
  }
  return JSON.stringify(body, null, 2);
}

async function main() {
  loadDotEnvLocal();
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printUsage();
    return;
  }

  const result = await runDailyNow({
    baseUrl: options.baseUrl,
    secret: options.secret,
  });

  console.log(`[run:daily] target=${result.baseUrl}`);
  console.log(`[run:daily] trigger status=${result.trigger.status}`);
  if (result.trigger.networkError) {
    console.log(`[run:daily] trigger networkError=${result.trigger.networkError}`);
  }
  console.log(`[run:daily] trigger body=${stringify(result.trigger.body)}`);

  if (result.health.ok) {
    console.log(`[run:daily] latest run=${stringify(result.latestRun)}`);
  } else {
    console.log(`[run:daily] health status=${result.health.status}`);
    console.log(`[run:daily] health body=${stringify(result.health.body)}`);
  }

  if (result.home.ok) {
    const generatedAt = result.home.body?.generatedAt ?? null;
    const events = Array.isArray(result.home.body?.events) ? result.home.body.events.length : null;
    console.log(`[run:daily] home generatedAt=${generatedAt}`);
    console.log(`[run:daily] home events=${events}`);
  } else {
    console.log(`[run:daily] home status=${result.home.status}`);
    console.log(`[run:daily] home body=${stringify(result.home.body)}`);
  }

  if (!result.trigger.ok && result.effectiveSuccess) {
    console.log(
      "[run:daily] trigger returned non-200, but a fresh successful pipeline run was observed.",
    );
  }

  if (!result.trigger.ok && !result.effectiveSuccess) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[run:daily] error=${(error).message}`);
  process.exitCode = 1;
});
