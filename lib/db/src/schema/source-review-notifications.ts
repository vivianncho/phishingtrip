import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// Delivery bookkeeping only. Never consumed as evidence or used to renew sources.
export const sourceReviewNotifications = pgTable("source_review_notifications", {
  key: text("key").primaryKey(),
  sourceId: text("source_id").notNull(),
  deliveryId: text("delivery_id").notNull(),
  status: text("status", { enum: ["pending", "sent", "failed"] }).notNull(),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  errorCode: text("error_code"),
});
export const insertSourceReviewNotificationSchema = createInsertSchema(sourceReviewNotifications);
export type SourceReviewNotificationRow = typeof sourceReviewNotifications.$inferSelect;
