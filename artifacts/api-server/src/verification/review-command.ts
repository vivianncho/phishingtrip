import { readFile } from "node:fs/promises";
import { closeDatabasePools, reviewDb } from "@workspace/db";
import { listSourceReviews, recordSourceReview, SourceReviewError } from "./source-review";
import { SOURCE_REVIEW_WARNING_DAYS } from "./policy";
import { ZodError } from "zod";
import { ApiFault } from "./policy";
import { runReviewNotifications } from "./review-scheduler";
import { notificationStatus } from "./review-notification-store";
import { NotificationConfigError } from "./review-notifications";
import { AliasReviewError, listPropertyAliases, recordAliasReview } from "./alias-review";

const usage = "Usage: review:directory queue [--days 0..90] | review <review.json> | alias-list [property-id] | alias-review <review.json> | notify | notification-status";
async function main() {
  const [command, ...args] = process.argv.slice(2);
  let result: unknown;
  if (command === "queue" && (args.length === 0 || (args.length === 2 && args[0] === "--days" && /^\d+$/.test(args[1]!)))) {
    result = await listSourceReviews(args.length ? Number(args[1]) : SOURCE_REVIEW_WARNING_DAYS, Date.now(), reviewDb);
  } else if (command === "review" && args.length === 1) {
    result = await recordSourceReview(JSON.parse(await readFile(args[0]!, "utf8")));
  } else if (command === "alias-list" && args.length <= 1) {
    result = await listPropertyAliases(args[0]);
  } else if (command === "alias-review" && args.length === 1) {
    result = await recordAliasReview(JSON.parse(await readFile(args[0]!, "utf8")));
  } else if (command === "notify" && args.length === 0) {
    const delivery = await runReviewNotifications();
    result = delivery;
    if (delivery.failed) process.exitCode = 1;
  } else if (command === "notification-status" && args.length === 0) {
    const rows = await notificationStatus();
    result = rows;
    if (rows.some((row) => row.status === "failed" ||
        (row.status === "pending" && row.attemptedAt.getTime() <= Date.now() - 60_000))) process.exitCode = 1;
  } else {
    throw new SourceReviewError(usage);
  }
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}
main().catch((error: unknown) => {
  // Validation is actionable; never dump database errors or connection details.
  const message = error instanceof AliasReviewError || error instanceof SourceReviewError || error instanceof ApiFault || error instanceof NotificationConfigError ? error.message :
    error instanceof ZodError ? error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n") :
    error instanceof SyntaxError ? "Review file must contain valid JSON." :
    "Review command failed; check configuration and database setup.";
  process.stderr.write(message + "\n");
  process.exitCode = 1;
}).finally(closeDatabasePools);
