import { pool } from "@workspace/db";
import { assertPropertyIdentities } from "./property-audit";

assertPropertyIdentities().then(() => {
  process.stdout.write("Directory identity audit passed; no rows changed.\n");
}).catch((error: unknown) => {
  process.stderr.write(error instanceof Error && error.message.startsWith("Directory identity audit failed:")
    ? `${error.message}\n` : "Directory identity audit could not run; check database setup.\n");
  process.exitCode = 1;
}).finally(() => pool.end());
