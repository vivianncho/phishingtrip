import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { DAY_MS } from "./source-policy";
import { SOURCE_REVIEW_WARNING_DAYS } from "./policy";
import type { listSourceReviews } from "./source-review";

export type QueueItem = Awaited<ReturnType<typeof listSourceReviews>>[number];
export class NotificationConfigError extends Error {}
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export interface NotificationConfig {
  destination: string;
  recipients: string[];
  warningDays: number;
  intervalMs: number;
  repeatMs: number;
  token?: string;
}

// This function never reports the invalid value: destinations may contain secrets.
export function notificationConfig(env: NodeJS.ProcessEnv): NotificationConfig {
  try {
    const destination = z.string().url().parse(env.SOURCE_REVIEW_WEBHOOK_URL);
    const url = new URL(destination);
    if (url.protocol !== "https:" || url.username || url.password || url.hash) throw new Error();
    const recipients = z.array(z.string().trim().min(1).max(200)).min(1).max(20)
      .parse((env.SOURCE_REVIEW_RECIPIENTS ?? "").split(","));
    const integer = (key: string, fallback: number, min: number, max: number) =>
      z.coerce.number().int().min(min).max(max).parse(env[key] ?? fallback);
    return {
      destination, recipients: [...new Set(recipients)].sort(),
      warningDays: integer("SOURCE_REVIEW_WARNING_DAYS", SOURCE_REVIEW_WARNING_DAYS, 0, 90),
      intervalMs: integer("SOURCE_REVIEW_INTERVAL_MINUTES", 1440, 1, 10080) * 60_000,
      repeatMs: integer("SOURCE_REVIEW_REPEAT_DAYS", 7, 1, 90) * DAY_MS,
      token: env.SOURCE_REVIEW_WEBHOOK_TOKEN,
    };
  } catch {
    throw new NotificationConfigError("Invalid source-review notification configuration; see the operator README.");
  }
}

export interface NotificationStore {
  attemptTimes(keys: string[]): Promise<Map<string, number>>;
  claim(key: string, sourceId: string, now: number, repeatMs: number): Promise<string | null>;
  finish(key: string, deliveryId: string, now: number, errorCode: string | null): Promise<void>;
}

export function notificationKey(item: QueueItem, config: NotificationConfig) {
  return hash([config.destination, config.recipients, item.source.id, item.expectedFingerprint, item.reasons]);
}

export function notificationPayload(item: QueueItem, config: NotificationConfig, deliveryId: string, now: number) {
  // Explicit allowlist: no raw queue object, phone number, human review notes or traveler data.
  return {
    type: "official_source_review_required",
    deliveryId,
    generatedAt: new Date(now).toISOString(),
    recipients: config.recipients,
    source: {
      id: item.source.id, companyId: item.company.id, companyName: item.company.name,
      sourceName: item.source.sourceName, sourceUrl: item.source.sourceUrl,
      region: item.contact.region, service: item.contact.service,
      reviewedAt: item.source.reviewedAt.toISOString(), effectiveExpiresAt: item.effectiveExpiresAt,
      reasons: item.reasons,
    },
    action: "A human must check the official source and use review:directory review to record a review. This notification does not renew evidence.",
  };
}

export type Delivery = (body: ReturnType<typeof notificationPayload>, config: NotificationConfig) => Promise<string | null>;

export async function deliverNotification(
  body: ReturnType<typeof notificationPayload>, config: NotificationConfig, request: typeof fetch = fetch,
): Promise<string | null> {
  try {
    const response = await request(config.destination, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(5000),
      headers: {
        "Content-Type": "application/json", "Idempotency-Key": body.deliveryId,
        ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    // Never read or log an upstream response body.
    await response.body?.cancel();
    return response.ok ? null : `http_${response.status}`;
  } catch {
    return "delivery_unavailable";
  }
}

export async function sendReviewNotifications(
  config: NotificationConfig,
  deps: { queue: (days: number, now: number) => Promise<QueueItem[]>; store: NotificationStore; deliver: Delivery },
  clock: number | (() => number) = Date.now,
) {
  const time = typeof clock === "number" ? () => clock : clock;
  const result = { queued: 0, sent: 0, failed: 0, suppressed: 0, deferred: 0 };
  const items = await deps.queue(config.warningDays, time());
  result.queued = items.length;
  const keyed = items.map((item) => ({ item, key: notificationKey(item, config) }));
  const attempts = await deps.store.attemptTimes(keyed.map(({ key }) => key));
  // Missing ledger records go first; then the least-recently attempted events.
  // Persisted timestamps keep capped batches progressing across restarts/replicas,
  // even when every delivery fails or every successful reminder is due again.
  keyed.sort((a, b) => {
    const first = attempts.get(a.key) ?? -Infinity;
    const second = attempts.get(b.key) ?? -Infinity;
    return first === second ? 0 : first < second ? -1 : 1;
  });
  for (const { item, key } of keyed) {
    if (result.sent + result.failed >= 100) { result.deferred++; continue; }
    const now = time();
    const deliveryId = await deps.store.claim(key, item.source.id, now, config.repeatMs);
    if (!deliveryId) { result.suppressed++; continue; }
    let errorCode: string | null;
    try {
      errorCode = await deps.deliver(notificationPayload(item, config, deliveryId, now), config);
    } catch {
      errorCode = "delivery_unavailable";
    }
    await deps.store.finish(key, deliveryId, time(), errorCode);
    if (errorCode) result.failed++; else result.sent++;
  }
  return result;
}

export const newDeliveryId = () => randomUUID();
