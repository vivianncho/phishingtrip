import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, pool, companies, officialContacts, contactSources, contactSourceReviews, sourceReviewNotifications } from "@workspace/db";
import { DAY_MS } from "./source-policy";
import { listSourceReviews, reviewQueueItem, type ReviewSubject } from "./source-review";
import {
  deliverNotification, notificationConfig, notificationKey, notificationPayload,
  sendReviewNotifications, type QueueItem, type NotificationConfig,
} from "./review-notifications";
import { notificationStatus, notificationStore } from "./review-notification-store";
import { startReviewScheduler } from "./review-scheduler";

after(() => pool.end());
const now = Date.parse("2026-12-01T12:00:00Z");
const config: NotificationConfig = {
  destination: "https://notifications.example/reviews", recipients: ["directory-operators"],
  warningDays: 14, intervalMs: DAY_MS, repeatMs: 7 * DAY_MS,
};
function fixture(): ReviewSubject {
  const id = `notification-${randomUUID()}`;
  return {
    company: { id, name: "Notification fixture", website: "https://fixture.example", category: "airline",
      listingType: "organization", brandId: null, propertyCode: null, address: null, city: null, subdivision: null, countryCode: null, propertyBrandType: null },
    contact: { id: `${id}-contact`, companyId: id, number: "+18002211212", region: "US", service: "Reservations", serviceType: "general" },
    source: { id: `${id}-source`, contactId: `${id}-contact`, sourceName: "Official fixture",
      sourceUrl: "https://fixture.example/contact", assertion: "listed",
      reviewedAt: new Date(now), expiresAt: new Date(now + 90 * DAY_MS) },
  };
}
async function rollbackTest(run: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<void>) {
  const rollback = new Error("notification fixture rollback");
  await assert.rejects(db.transaction(async (tx) => {
    await run(tx);
    throw rollback;
  }), (error) => error === rollback);
}

test("configuration requires an explicit HTTPS destination and recipients with bounded timing", () => {
  const env = { SOURCE_REVIEW_WEBHOOK_URL: config.destination, SOURCE_REVIEW_RECIPIENTS: " b,a,a " };
  const parsed = notificationConfig(env);
  assert.deepEqual(parsed.recipients, ["a", "b"]);
  assert.equal(parsed.warningDays, 14);
  assert.equal(parsed.intervalMs, DAY_MS);
  assert.equal(parsed.repeatMs, 7 * DAY_MS);
  for (const change of [
    { SOURCE_REVIEW_WEBHOOK_URL: "" }, { SOURCE_REVIEW_WEBHOOK_URL: "http://fixture.example" },
    { SOURCE_REVIEW_WEBHOOK_URL: "https://user:secret@fixture.example" },
    { SOURCE_REVIEW_WEBHOOK_URL: "https://fixture.example/#secret" },
    { SOURCE_REVIEW_RECIPIENTS: "" }, { SOURCE_REVIEW_RECIPIENTS: "a," },
    { SOURCE_REVIEW_WARNING_DAYS: "91" }, { SOURCE_REVIEW_WARNING_DAYS: "-1" },
    { SOURCE_REVIEW_WARNING_DAYS: "1.5" }, { SOURCE_REVIEW_INTERVAL_MINUTES: "0" },
    { SOURCE_REVIEW_REPEAT_DAYS: "0" }, { SOURCE_REVIEW_REPEAT_DAYS: "91" },
  ]) assert.throws(() => notificationConfig({ ...env, ...change }), {
    message: "Invalid source-review notification configuration; see the operator README.",
  });
});

test("notifications use the queue's exact warning, hard-age, stale and dispute boundaries", async () => {
  await rollbackTest(async (tx) => {
    const subject = fixture();
    const store = notificationStore(tx);
    let time = now + 76 * DAY_MS - 1;
    const sent: ReturnType<typeof notificationPayload>[] = [];
    const run = () => sendReviewNotifications(config, {
      queue: async (days, at) => {
        assert.equal(days, 14);
        const item = reviewQueueItem(subject, at, days);
        return item.reasons.length ? [item] : [];
      },
      store, deliver: async (body) => { sent.push(body); return null; },
    }, time);
    assert.equal((await run()).sent, 0);
    time++;
    assert.equal((await run()).sent, 1);
    assert.deepEqual(sent[0]!.source.reasons, ["expiring"]);
    assert.equal((await run()).suppressed, 1);
    time += config.repeatMs - 1;
    assert.equal((await run()).sent, 0);
    time++;
    assert.equal((await run()).sent, 1);
    assert.notEqual(sent[0]!.deliveryId, sent[1]!.deliveryId);
    time = now + 90 * DAY_MS;
    assert.equal((await run()).sent, 1); // Escalation bypasses reminder cooldown.
    assert.deepEqual(sent.at(-1)!.source.reasons, ["stale"]);
    subject.source.assertion = "disputed";
    assert.equal((await run()).sent, 1);
    assert.deepEqual(sent.at(-1)!.source.reasons, ["disputed", "stale"]);
    assert.equal((await run()).suppressed, 1);

    // Explicit shorter expiry and the 90-day cap both drive notifications.
    subject.source.assertion = "listed";
    subject.source.expiresAt = new Date(now + 20 * DAY_MS);
    assert.deepEqual(reviewQueueItem(subject, now + 6 * DAY_MS).reasons, ["expiring"]);
    assert.deepEqual(reviewQueueItem(subject, now + 20 * DAY_MS).reasons, ["stale"]);
    subject.source.expiresAt = new Date(now + 100 * DAY_MS);
    assert.deepEqual(reviewQueueItem(subject, now + 76 * DAY_MS).reasons, ["expiring"]);
    assert.deepEqual(reviewQueueItem(subject, now + 90 * DAY_MS).reasons, ["stale"]);
  });
});

test("failed delivery remains visible, retries use the same ID, and pending leases recover", async () => {
  await rollbackTest(async (tx) => {
    const item = reviewQueueItem(fixture(), now + 90 * DAY_MS);
    const store = notificationStore(tx);
    const key = notificationKey(item, config);
    const ids: string[] = [];
    const run = (at: number, fail: boolean) => sendReviewNotifications(config, {
      queue: async () => [item], store,
      deliver: async (body) => { ids.push(body.deliveryId); return fail ? "http_503" : null; },
    }, at);
    assert.equal((await run(now, true)).failed, 1);
    let row = (await notificationStatus(tx)).find((r) => r.key === key)!;
    assert.equal(row.status, "failed");
    assert.equal(row.errorCode, "http_503");
    assert.equal(row.sentAt, null);
    assert.equal((await run(now + 59_999, false)).suppressed, 1);
    assert.equal((await run(now + 60_000, false)).sent, 1);
    assert.equal(ids[0], ids[1]);
    row = (await notificationStatus(tx)).find((r) => r.key === key)!;
    assert.equal(row.status, "sent");
    assert.equal(row.errorCode, null);
    assert.equal(row.sentAt!.getTime(), now + 60_000);
    assert.equal((await run(now + DAY_MS, false)).suppressed, 1);

    const pendingKey = `${key}-pending`;
    const claimed = await store.claim(pendingKey, item.source.id, now, config.repeatMs);
    assert.ok(claimed);
    assert.equal(await store.claim(pendingKey, item.source.id, now + 59_999, config.repeatMs), null);
    assert.equal(await store.claim(pendingKey, item.source.id, now + 60_000, config.repeatMs), claimed);
  });
});

test("independent workers cannot simultaneously claim the same notification", async () => {
  const key = `concurrent-${randomUUID()}`;
  try {
    const first = notificationStore(), second = notificationStore();
    const claims = await Promise.all([
      first.claim(key, "fixture", now, config.repeatMs), second.claim(key, "fixture", now, config.repeatMs),
    ]);
    assert.equal(claims.filter(Boolean).length, 1);
    assert.equal(await notificationStore().claim(key, "fixture", now, config.repeatMs), null);
  } finally {
    await db.delete(sourceReviewNotifications).where(eq(sourceReviewNotifications.key, key));
  }
});

test("capped runs fairly attempt every source despite repeated failures and restarts", async () => {
  await rollbackTest(async (tx) => {
    const items = Array.from({ length: 250 }, () => reviewQueueItem(fixture(), now + 90 * DAY_MS));
    const attempts = new Map<string, number>();
    for (let day = 0; day < 6; day++) {
      // Recreate the store each run: ordering must survive process-local state loss.
      const result = await sendReviewNotifications(config, {
        queue: async () => items, store: notificationStore(tx),
        deliver: async (body) => {
          attempts.set(body.source.id, (attempts.get(body.source.id) ?? 0) + 1);
          return "http_503";
        },
      }, now + day * DAY_MS);
      assert.equal(result.failed, 100);
      assert.equal(result.deferred, 150);
      if (day === 2) assert.equal(attempts.size, 250);
    }
    assert.equal(attempts.size, 250);
    assert.ok([...attempts.values()].every((count) => count >= 2));
  });
});

test("capped recurring successes give older deferred reminders priority", async () => {
  await rollbackTest(async (tx) => {
    const items = Array.from({ length: 150 }, () => reviewQueueItem(fixture(), now + 90 * DAY_MS));
    const attempts = new Map<string, number>();
    for (let run = 0; run < 4; run++) {
      const result = await sendReviewNotifications(config, {
        queue: async () => items, store: notificationStore(tx),
        deliver: async (body) => {
          attempts.set(body.source.id, (attempts.get(body.source.id) ?? 0) + 1);
          return null;
        },
      }, now + run * config.repeatMs);
      assert.equal(result.sent, 100);
    }
    assert.equal(attempts.size, 150);
    assert.ok([...attempts.values()].every((count) => count >= 2));
  });
});

test("the real read-only queue sends only curated data and never changes evidence or audit rows", async () => {
  await rollbackTest(async (tx) => {
    const subject = fixture();
    subject.source.expiresAt = new Date(now + DAY_MS);
    await tx.insert(companies).values(subject.company);
    await tx.insert(officialContacts).values(subject.contact);
    await tx.insert(contactSources).values(subject.source);
    const before = await tx.select().from(contactSources).where(eq(contactSources.id, subject.source.id));
    const reviewsBefore = await tx.select().from(contactSourceReviews).where(eq(contactSourceReviews.sourceId, subject.source.id));
    const sent: ReturnType<typeof notificationPayload>[] = [];
    const deps = {
      queue: async (days: number, at: number) => (await listSourceReviews(days, at, tx))
        .filter((r) => r.source.id === subject.source.id),
      store: notificationStore(tx),
      deliver: async (body: ReturnType<typeof notificationPayload>) => { sent.push(body); return null; },
    };
    assert.equal((await sendReviewNotifications(config, deps, now)).sent, 1);
    assert.equal((await sendReviewNotifications(config, deps, now)).suppressed, 1);
    assert.deepEqual(await tx.select().from(contactSources).where(eq(contactSources.id, subject.source.id)), before);
    assert.deepEqual(await tx.select().from(contactSourceReviews).where(eq(contactSourceReviews.sourceId, subject.source.id)), reviewsBefore);
    const payload = JSON.stringify(sent);
    assert.ok(!payload.includes(subject.contact.number));
    assert.ok(!payload.includes("expectedFingerprint"));
    const withExtraneousData = { ...(await deps.queue(14, now))[0]!,
      travelerNumber: "private traveler number", browsingData: "private browsing" } as QueueItem;
    assert.ok(!JSON.stringify(notificationPayload(withExtraneousData, config, "delivery", now)).includes("private"));
    // Destination/recipient/source edits create a new event, not a suppressed one.
    const item = (await deps.queue(14, now))[0]!;
    assert.notEqual(notificationKey(item, config), notificationKey(item, { ...config, recipients: ["another-team"] }));
    assert.notEqual(notificationKey(item, config), notificationKey(item, { ...config, destination: "https://other.example" }));
    assert.notEqual(notificationKey(item, config), notificationKey({ ...item, expectedFingerprint: "changed" }, config));
    // A human review that removes all reasons removes the source from notifications.
    subject.source.reviewedAt = new Date(now + 1);
    subject.source.expiresAt = new Date(now + 90 * DAY_MS);
    await tx.update(contactSources).set(subject.source).where(eq(contactSources.id, subject.source.id));
    assert.equal((await sendReviewNotifications(config, deps, now + 1)).queued, 0);
  });
});

test("webhook transport is bounded, authenticated, idempotent, and sanitizes failures", async () => {
  const body = notificationPayload(reviewQueueItem(fixture(), now + 90 * DAY_MS), config, "delivery-1", now);
  let calls = 0;
  const request = (async (url, init) => {
    calls++;
    assert.equal(url, config.destination);
    assert.equal(init!.method, "POST");
    assert.equal(init!.redirect, "error");
    assert.ok(init!.signal instanceof AbortSignal);
    assert.equal((init!.headers as Record<string, string>)["Idempotency-Key"], "delivery-1");
    assert.equal((init!.headers as Record<string, string>).Authorization, "Bearer fixture-token");
    assert.deepEqual(JSON.parse(init!.body as string), body);
    return new Response(null, { status: 202 });
  }) as typeof fetch;
  assert.equal(await deliverNotification(body, { ...config, token: "fixture-token" }, request), null);
  assert.equal(calls, 1);
  assert.equal(await deliverNotification(body, config, (async () => new Response("secret", { status: 503 })) as typeof fetch), "http_503");
  assert.equal(await deliverNotification(body, config, (async () => { throw new Error("secret URL"); }) as typeof fetch), "delivery_unavailable");
});

test("scheduler is opt-in, runs immediately and periodically, and prevents local overlap", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  const env = {
    SOURCE_REVIEW_WEBHOOK_URL: config.destination, SOURCE_REVIEW_RECIPIENTS: "operators",
    SOURCE_REVIEW_INTERVAL_MINUTES: "1", SOURCE_REVIEW_NOTIFICATIONS_ENABLED: "true",
  };
  let calls = 0;
  let release: (() => void) | undefined;
  const execute = async () => {
    calls++;
    await new Promise<void>((resolve) => { release = resolve; });
    return { queued: 0, sent: 0, failed: 0, suppressed: 0, deferred: 0 };
  };
  startReviewScheduler({ ...env, SOURCE_REVIEW_NOTIFICATIONS_ENABLED: "false" }, execute)();
  startReviewScheduler({ ...env, SOURCE_REVIEW_WEBHOOK_URL: "" }, execute)();
  assert.equal(calls, 0);
  const stop = startReviewScheduler(env, execute);
  assert.equal(calls, 1);
  t.mock.timers.tick(60_000);
  assert.equal(calls, 1);
  release!();
  await new Promise((resolve) => setImmediate(resolve));
  t.mock.timers.tick(60_000);
  assert.equal(calls, 2);
  release!();
  await new Promise((resolve) => setImmediate(resolve));
  stop();
  t.mock.timers.tick(60_000);
  assert.equal(calls, 2);
});
