import { logger } from "../lib/logger";
import { listSourceReviews } from "./source-review";
import { notificationStore } from "./review-notification-store";
import { deliverNotification, notificationConfig, sendReviewNotifications, type NotificationConfig } from "./review-notifications";

const send = (config: NotificationConfig) => sendReviewNotifications(config, {
  queue: listSourceReviews, store: notificationStore(), deliver: deliverNotification,
});

export async function runReviewNotifications(env = process.env) {
  return send(notificationConfig(env));
}

export function startReviewScheduler(env = process.env, execute = send): () => void {
  if (env.SOURCE_REVIEW_NOTIFICATIONS_ENABLED !== "true") {
    if (env.SOURCE_REVIEW_NOTIFICATIONS_ENABLED && env.SOURCE_REVIEW_NOTIFICATIONS_ENABLED !== "false") {
      logger.error({ code: "source_review_config_invalid" }, "Source review notifications disabled: enabled must be true or false");
    }
    return () => {};
  }
  let config;
  try {
    config = notificationConfig(env);
  } catch {
    logger.error({ code: "source_review_config_invalid" }, "Source review notifications could not start; check configuration");
    return () => {};
  }
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const result = await execute(config);
      if (result.failed) logger.error(result, "Source review notifications had delivery failures");
      else logger.info(result, "Source review notification run finished");
    } catch {
      // No raw errors: database errors and destination URLs may contain credentials.
      logger.error({ code: "source_review_run_failed" }, "Source review notifications failed; inspect configuration, database and notification-status");
    } finally {
      running = false;
    }
  };
  logger.info({ intervalMinutes: config.intervalMs / 60_000 }, "Source review notification scheduler started");
  void tick();
  const timer = setInterval(() => { void tick(); }, config.intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
