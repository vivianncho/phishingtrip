import { closeDatabasePools } from "@workspace/db";
import { ZodError } from "zod";
import { SourceReviewError } from "./source-review";
import { historyUsage, listReviewHistory, parseHistoryArgs } from "./review-history";

async function main() {
  const result = await listReviewHistory(parseHistoryArgs(process.argv.slice(2)));
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

main().catch((error: unknown) => {
  // Do not print connection details, raw database errors or stored audit content on failure.
  const message = error instanceof SourceReviewError ? error.message :
    error instanceof ZodError ? `Invalid history arguments or audit record. ${historyUsage}` :
    "History command failed; check database setup.";
  process.stderr.write(message + "\n");
  process.exitCode = 1;
}).finally(closeDatabasePools);
