#!/usr/bin/env node
/**
 * One-command production setup for the AI Studio Photoshoot feature.
 *
 * Usage:  VERCEL_TOKEN=vcp_xxx node scripts/vercel-studio-setup.mjs
 *
 * 1. Upserts the Z_AI_CONFIG env var (from /etc/.z-ai-config or ~/.z-ai-config)
 *    on all environments of the `ln-jewellers` Vercel project.
 * 2. Triggers a production deployment from GitHub main and waits until READY.
 *
 * Safe to re-run — env upsert is idempotent (?upsert=true).
 */
import fs from "node:fs";

const TOKEN = process.env.VERCEL_TOKEN;
if (!TOKEN) {
  console.error("Pass the token: VERCEL_TOKEN=vcp_… node scripts/vercel-studio-setup.mjs");
  process.exit(1);
}
const API = "https://api.vercel.com";
const TEAM = process.env.VERCEL_TEAM_ID; // optional
const qs = TEAM ? `?teamId=${TEAM}` : "";
const PROJECT = process.env.VERCEL_PROJECT_ID || "ln-jewellers";
const GIT_REPO = "Soni-Raghav/ln-jewellers";

// ---------- 1. build the config payload ----------
const cfgPaths = ["/etc/.z-ai-config", `${process.env.HOME}/.z-ai-config`];
let zai = null;
for (const p of cfgPaths) {
  try {
    zai = JSON.parse(fs.readFileSync(p, "utf-8"));
    break;
  } catch {}
}
if (!zai?.baseUrl || !zai?.apiKey) {
  console.error("No .z-ai-config found to export");
  process.exit(1);
}
const zaiPayload = {
  baseUrl: zai.baseUrl,
  apiKey: zai.apiKey,
  token: zai.token,
  chatId: zai.chatId,
  userId: zai.userId,
};

const j = async (url, init = {}) => {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${url}\n${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
};

// ---------- 2. resolve project id ----------
const proj = await j(`${API}/v9/projects/${PROJECT}${qs}`);
const projectId = proj.id;
console.log(`✓ project ${proj.name} (${projectId})`);

// ---------- 3. upsert env ----------
const envBody = {
  key: "Z_AI_CONFIG",
  value: JSON.stringify(zaiPayload),
  type: "encrypted",
  target: ["production", "preview", "development"],
  gitBranchEnabled: false,
};
await j(`${API}/v10/projects/${projectId}/env?upsert=true${TEAM ? `&teamId=${TEAM}` : ""}`, {
  method: "POST",
  body: JSON.stringify(envBody),
});
console.log("✓ Z_AI_CONFIG env upserted (production, preview, development)");

// ---------- 4. deploy production from git ----------
const dep = await j(`${API}/v13/deployments${qs}`, {
  method: "POST",
  body: JSON.stringify({
    name: proj.name,
    project: projectId,
    target: "production",
    gitSource: { type: "github", repo: GIT_REPO, ref: "main" },
  }),
});
console.log(`⏳ deployment ${dep.id} queued — polling…`);

const t0 = Date.now();
for (;;) {
  await new Promise((r) => setTimeout(r, 10_000));
  const d = await j(`${API}/v13/deployments/${dep.id}${qs}`);
  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  console.log(`   ${d.readyState ?? d.readyState} (${mins} min)`);
  if (d.readyState === "READY") {
    console.log(`🎉 deployed → https://${d.url}`);
    process.exit(0);
  }
  if (["ERROR", "CANCELED"].includes(d.readyState)) {
    console.error(`❌ deployment ${d.readyState}`);
    process.exit(1);
  }
}
