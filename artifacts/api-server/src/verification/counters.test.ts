import test, { after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "@workspace/db";
import { Router } from "express";
import request from "supertest";
import pino from "pino";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { createApp } from "../app";
import { PostgresCounters, type Counters } from "./counters";
import { counterFixture } from "./counter-fixture";
import { lookupConfig, TwilioBasic, type LookupConfig } from "./twilio";

after(async () => { await pool.end(); });
const silent = pino({ level: "silent" });
const broken: Counters = { check: async () => { throw new Error("PRIVATE_STORE_ERROR"); } };
const config: LookupConfig = {
  enabled: true, key: `SK${"1".repeat(32)}`, secret: "fixture-only",
  timeoutMs: 100, maxRequests: 7, requestsPerMinute: 100,
  maxSpendMicroUsd: 100000, requestCostMicroUsd: 1000,
};
const rule = { key: "requests", amount: 1, limit: 7, windowMs: 60000 };

test("two OS processes cannot multiply counters and a restarted process retains usage", async () => {
  const { namespace } = counterFixture();
  const run = async () => {
    const result = await promisify(execFile)(process.execPath, [
      "--import", "tsx", fileURLToPath(new URL("./counter-worker.fixture.ts", import.meta.url)), namespace,
    ], { timeout: 15000 });
    return Number(result.stdout);
  };
  const results = await Promise.all([run(), run()]);
  assert.equal(results[0]! + results[1]!, 7);
  assert.equal(await run(), 0);
});

test("two independent instances atomically share budgets, survive replacement and expire", async () => {
  let now = 120000;
  const { namespace, store: a } = counterFixture(() => now);
  const b = new PostgresCounters(namespace, pool, () => now);
  const results = await Promise.all(Array.from({ length: 40 }, (_, i) => (i % 2 ? a : b).check([rule], true)));
  assert.equal(results.filter((r) => r.allowed).length, 7);
  const replacement = new PostgresCounters(namespace, pool, () => now);
  assert.equal((await replacement.check([rule], true)).allowed, false);
  now += 60000;
  assert.equal((await replacement.check([rule], true)).allowed, true);
  const rows = await pool.query("SELECT used, expires_at FROM usage_counters WHERE namespace = $1", [namespace]);
  assert.equal(rows.rows.length, 1);
  assert.equal(Number(rows.rows[0].used), 1);
  assert.equal(rows.rows[0].expires_at.getTime(), 240000);
});

test("two HTTP servers share client and global ceilings; health and failures remain safe", async () => {
  const { namespace, store } = counterFixture();
  const router = () => Router().get("/probe", (_req, res) => { res.json({ ok: true }); })
    .get("/healthz", (_req, res) => { res.json({ status: "ok" }); });
  const a = createApp({ router: router(), logger: silent, rateMax: 5, counters: store });
  const b = createApp({ router: router(), logger: silent, rateMax: 5, counters: new PostgresCounters(namespace) });
  const responses = await Promise.all(Array.from({ length: 20 }, (_, i) => request(i % 2 ? a : b).get("/api/probe").set("X-Forwarded-For", `192.0.2.${i}`)));
  assert.equal(responses.filter((r) => r.status === 200).length, 5);
  assert.equal(responses.filter((r) => r.status === 429 && Number(r.headers["retry-after"]) > 0).length, 15);
  const rows = await pool.query("SELECT key, used FROM usage_counters WHERE namespace = $1", [namespace]);
  assert.equal(rows.rows.length, 2);
  assert.ok(rows.rows.every((r) => r.key === "global" || /^[a-f0-9]{64}$/.test(r.key)));
  await store.check([{ key: "global", amount: 580, limit: 600, windowMs: 60000 }], true);
  await request(b).get("/api/probe").expect(429);
  await request(b).get("/api/healthz").expect(200);
  const unavailable = createApp({ router: router(), logger: silent, counters: broken });
  const failure = await request(unavailable).get("/api/probe").expect(503);
  assert.equal(JSON.stringify(failure.body).includes("PRIVATE"), false);
  await request(unavailable).get("/api/healthz").expect(200);
});

test("two providers reserve daily requests and spend before network, including failed attempts", async () => {
  let now = 86400000, calls = 0;
  const { namespace, store } = counterFixture(() => now);
  const upstream = (async () => { calls++; return new Response("", { status: 500 }); }) as typeof fetch;
  const a = new TwilioBasic(config, upstream, () => now, store);
  const b = new TwilioBasic(config, upstream, () => now, new PostgresCounters(namespace, pool, () => now));
  try {
    await Promise.all(Array.from({ length: 30 }, (_, i) => (i % 2 ? a : b).lookup(`+1202555${String(i).padStart(4, "0")}`)));
    assert.equal(calls, 7);
    a.close();
    const replacement = new TwilioBasic(config, upstream, () => now, new PostgresCounters(namespace, pool, () => now));
    try {
      assert.equal(await replacement.status(), "budget_exhausted");
      now += 86400000;
      await replacement.lookup("+12025559999");
      assert.equal(calls, 8);
    } finally { replacement.close(); }
    const rows = await pool.query("SELECT key FROM usage_counters WHERE namespace = $1", [namespace]);
    assert.ok(rows.rows.every((r) => ["daily-requests", "daily-spend", "minute-requests"].includes(r.key)));
  } finally { a.close(); b.close(); }
});

test("spend and minute denials do not consume other reservations; store failure never calls upstream", async () => {
  let now = 86400000, calls = 0;
  const { namespace, store } = counterFixture(() => now);
  const upstream = (async () => { calls++; return new Response("", { status: 429 }); }) as typeof fetch;
  const a = new TwilioBasic({ ...config, requestsPerMinute: 1, maxSpendMicroUsd: 2000 }, upstream, () => now, store);
  const b = new TwilioBasic({ ...config, requestsPerMinute: 1, maxSpendMicroUsd: 2000 }, upstream, () => now, new PostgresCounters(namespace, pool, () => now));
  try {
    const first = await Promise.all([a.lookup("+12025550001"), b.lookup("+12025550002")]);
    assert.equal(calls, 1);
    assert.ok(first.some((r) => r.status === "rate_limited"));
    now += 60000;
    await b.lookup("+12025550003");
    assert.equal(calls, 2);
    assert.equal((await a.lookup("+12025550004")).status, "budget_exhausted");
    const rows = await pool.query("SELECT key, used FROM usage_counters WHERE namespace = $1", [namespace]);
    assert.equal(Number(rows.rows.find((r) => r.key === "daily-requests").used), 2);
    assert.equal(Number(rows.rows.find((r) => r.key === "daily-spend").used), 2000);
    const failed = new TwilioBasic(config, upstream, () => now, broken);
    try {
      assert.equal(await failed.status(), "unavailable");
      assert.equal((await failed.lookup("+12025550005")).status, "unavailable");
      assert.equal(calls, 2);
    } finally { failed.close(); }
    const noSpend = new TwilioBasic({ ...config, maxSpendMicroUsd: 0 }, upstream, () => now, counterFixture().store);
    try {
      assert.equal((await noSpend.lookup("+12025550006")).status, "budget_exhausted");
      assert.equal(calls, 2);
    } finally { noSpend.close(); }
    assert.equal(lookupConfig().enabled, false);
  } finally { a.close(); b.close(); }
});
