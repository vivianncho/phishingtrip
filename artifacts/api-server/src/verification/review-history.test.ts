import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { db, pool, companies, officialContacts, contactSources, contactSourceReviews } from "@workspace/db";
import { eq } from "drizzle-orm";
import { listReviewHistory, parseHistoryArgs } from "./review-history";

after(async () => { await pool.end(); });

test("history arguments have strict bounds, defaults and exact source filtering", async () => {
  assert.deepEqual(parseHistoryArgs([]), { limit: 20, offset: 0 });
  assert.deepEqual(parseHistoryArgs(["--offset", "10000", "--source-id", "source-a", "--limit", "100"]),
    { sourceId: "source-a", limit: 100, offset: 10000 });
  for (const args of [
    ["--limit", "0"], ["--limit", "101"], ["--offset", "-1"], ["--offset", "10001"],
    ["--limit", "1.5"], ["--limit", "1e2"], ["--limit", "Infinity"],
    ["--limit", "900719925474099300"], ["--source-id", " "], ["--source-id", "x".repeat(201)],
    ["--source-id"], ["--source-id", "--limit"], ["--unknown", "1"],
    ["--limit", "1", "--limit", "2"], ["source-a"], ["--offset", "0", "extra"],
  ]) assert.throws(() => parseHistoryArgs(args), args.join(" "));
  // Service-level validation also happens before any database access.
  for (const input of [{ limit: 101 }, { offset: -1 }, { offset: 10001 }, { sourceId: "" }]) {
    await assert.rejects(listReviewHistory(input));
  }
});

test("history orders by recorded time then ID, pages without overlap, filters and never mutates", async () => {
  const rollback = new Error("rollback history fixture");
  await assert.rejects(db.transaction(async (tx) => {
    const prefix = `history-${randomUUID()}`;
    await tx.insert(companies).values({
      id: prefix, name: "History fixture", category: "airline", website: "https://fixture.example",
    });
    await tx.insert(officialContacts).values({
      id: prefix, companyId: prefix, number: "+18002211212", region: "US", service: "Reservations",
    });
    const source = {
      id: prefix, contactId: prefix, sourceName: "Fixture", sourceUrl: "https://fixture.example/contact",
      assertion: "listed" as const, reviewedAt: new Date("2026-01-01Z"), expiresAt: new Date("2026-02-01Z"),
    };
    await tx.insert(contactSources).values([source, { ...source, id: `${prefix}-other` }, { ...source, id: `${prefix}-empty` }]);
    const before = { source: {
      ...source, reviewedAt: source.reviewedAt.toISOString(), expiresAt: source.expiresAt.toISOString(),
    } };
    const rows = ["a", "b", "c", "d"].map((suffix, i) => ({
      id: `${prefix}-${suffix}`, sourceId: prefix, reviewer: `operator-${suffix}`,
      note: `Confirmed historical scope ${suffix}.`,
      recordedAt: new Date(i === 0 ? "2099-01-01Z" : "2099-01-02Z"),
      before,
      after: { source: { ...before.source, assertion: "disputed", reviewedAt: `2026-01-0${5 - i}T00:00:00.000Z` } },
    }));
    await tx.insert(contactSourceReviews).values([
      ...rows, { ...rows[0]!, id: `${prefix}-other-audit`, sourceId: `${prefix}-other`, recordedAt: new Date("2099-01-03Z") },
    ]);
    const first = await listReviewHistory({ sourceId: prefix, limit: 2 }, tx);
    assert.deepEqual(first.items.map((r) => r.id), [`${prefix}-d`, `${prefix}-c`]);
    assert.equal(first.nextOffset, 2);
    assert.equal(first.items[0]!.reviewer, "operator-d");
    assert.equal(first.items[0]!.note, rows[3]!.note);
    assert.equal(first.items[0]!.reviewedAt, "2026-01-02T00:00:00.000Z");
    assert.equal(first.items[0]!.recordedAt.toISOString(), "2099-01-02T00:00:00.000Z");
    assert.deepEqual(first.items[0]!.before, before);
    assert.deepEqual(first.items[0]!.after, rows[3]!.after);
    const second = await listReviewHistory({ sourceId: prefix, limit: 2, offset: first.nextOffset! }, tx);
    assert.deepEqual(second.items.map((r) => r.id), [`${prefix}-b`, `${prefix}-a`]);
    assert.equal(second.nextOffset, null);
    const beyond = await listReviewHistory({ sourceId: prefix, offset: 10000 }, tx);
    assert.deepEqual(beyond.items, []);
    assert.equal(beyond.nextOffset, null);
    const empty = await listReviewHistory({ sourceId: `${prefix}-empty` }, tx);
    assert.deepEqual(empty.items, []);
    assert.equal(empty.nextOffset, null);
    await assert.rejects(listReviewHistory({ sourceId: `${prefix}-missing` }, tx), /Source not found/);
    await assert.rejects(listReviewHistory({ sourceId: `${prefix}' OR 1=1 --` }, tx), /Source not found/);
    const all = await listReviewHistory({}, tx);
    const fixtureIds = all.items.filter((row) => row.sourceId.startsWith(prefix)).map((row) => row.id);
    assert.deepEqual(fixtureIds, [`${prefix}-other-audit`, `${prefix}-d`, `${prefix}-c`, `${prefix}-b`, `${prefix}-a`]);
    assert.deepEqual((await tx.select().from(contactSources).where(eq(contactSources.id, prefix)))[0], source);
    assert.equal((await tx.select().from(contactSourceReviews).where(eq(contactSourceReviews.sourceId, prefix))).length, 4);
    throw rollback;
  }), (error) => error === rollback);
});

test("history shell command returns JSON and reports failures without database details", () => {
  const run = (args: string[]) => spawnSync(process.execPath,
    ["--import", "tsx", "src/verification/history-command.ts", ...args], { encoding: "utf8" });
  const success = run(["--limit", "1"]);
  assert.equal(success.status, 0, success.stderr);
  const page = JSON.parse(success.stdout);
  assert.equal(page.limit, 1);
  assert.ok(Array.isArray(page.items));
  const invalid = run(["--offset", "-1"]);
  assert.equal(invalid.status, 1);
  assert.equal(invalid.stdout, "");
  assert.match(invalid.stderr, /Usage: history:directory/);
  const unknown = run(["--source-id", `missing-${randomUUID()}`]);
  assert.equal(unknown.status, 1);
  assert.equal(unknown.stdout, "");
  assert.equal(unknown.stderr, "Source not found\n");
});
