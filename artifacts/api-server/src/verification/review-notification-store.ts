import { sql, desc, inArray } from "drizzle-orm";
import { db, sourceReviewNotifications } from "@workspace/db";
import { newDeliveryId, type NotificationStore } from "./review-notifications";

type Database = Pick<typeof db, "execute" | "select">;
export function notificationStore(database: Database = db): NotificationStore {
  return {
    async attemptTimes(keys) {
      const times = new Map<string, number>();
      // Bound SQL parameter counts even for large directories.
      for (let offset = 0; offset < keys.length; offset += 500) {
        const rows = await database.select({
          key: sourceReviewNotifications.key, attemptedAt: sourceReviewNotifications.attemptedAt,
        }).from(sourceReviewNotifications)
          .where(inArray(sourceReviewNotifications.key, keys.slice(offset, offset + 500)));
        for (const row of rows) times.set(row.key, row.attemptedAt.getTime());
      }
      return times;
    },
    async claim(key, sourceId, now, repeatMs) {
      // Atomic durable lease: overlapping schedulers/restarts cannot both claim.
      // A crashed or failed attempt reuses its delivery ID for receiver-side idempotency.
      const result = await database.execute<{ delivery_id: string }>(sql`
        INSERT INTO source_review_notifications
          (key, source_id, delivery_id, status, attempted_at)
        VALUES (${key}, ${sourceId}, ${newDeliveryId()}, 'pending', ${new Date(now)})
        ON CONFLICT (key) DO UPDATE SET
          delivery_id = CASE WHEN source_review_notifications.status = 'sent'
            THEN EXCLUDED.delivery_id ELSE source_review_notifications.delivery_id END,
          status = 'pending', attempted_at = EXCLUDED.attempted_at, error_code = NULL
        WHERE source_review_notifications.attempted_at <= ${new Date(now - 60_000)}
          AND (source_review_notifications.sent_at IS NULL
            OR source_review_notifications.sent_at <= ${new Date(now - repeatMs)})
        RETURNING delivery_id
      `);
      return result.rows[0]?.delivery_id ?? null;
    },
    async finish(key, deliveryId, now, errorCode) {
      await database.execute(sql`
        UPDATE source_review_notifications SET
          status = ${errorCode ? "failed" : "sent"}, error_code = ${errorCode},
          sent_at = CASE WHEN ${errorCode === null} THEN ${new Date(now)} ELSE sent_at END
        WHERE key = ${key} AND delivery_id = ${deliveryId} AND status = 'pending'
      `);
    },
  };
}

export async function notificationStatus(database: Database = db) {
  return database.select({
    key: sourceReviewNotifications.key, sourceId: sourceReviewNotifications.sourceId,
    status: sourceReviewNotifications.status, attemptedAt: sourceReviewNotifications.attemptedAt,
    sentAt: sourceReviewNotifications.sentAt, errorCode: sourceReviewNotifications.errorCode,
  }).from(sourceReviewNotifications).orderBy(desc(sourceReviewNotifications.attemptedAt)).limit(100);
}
