import { readFile } from "node:fs/promises";
import { pool } from "@workspace/db";
import { listSourceReviews, recordSourceReview, SourceReviewError } from "./source-review";
import { SOURCE_REVIEW_WARNING_DAYS } from "./policy";
import { ZodError } from "zod";
import { ApiFault } from "./policy";

const usage = "Usage: review:directory queue [--days 0..90] | review:directory review <review.json>";
async function main() {
  const [command, ...args] = process.argv.slice(2);
  let result: unknown;
  if (command === "queue" && (args.length === 0 || (args.length === 2 && args[0] === "--days" && /^\d+$/.test(args[1]!)))) {
    result = await listSourceReviews(args.length ? Number(args[1]) : SOURCE_REVIEW_WARNING_DAYS);
  } else if (command === "review" && args.length === 1) {
    result = await recordSourceReview(JSON.parse(await readFile(args[0]!, "utf8")));
  } else {
    throw new SourceReviewError(usage);
  }
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}
main().catch((error: unknown) => {
  // Validation is actionable; never dump database errors or connection details.
  const message = error instanceof SourceReviewError || error instanceof ApiFault ? error.message :
    error instanceof ZodError ? error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n") :
    error instanceof SyntaxError ? "Review file must contain valid JSON." :
    "Review command failed; check the review file and database setup.";
  process.stderr.write(message + "\n");
  process.exitCode = 1;
}).finally(() => pool.end());
