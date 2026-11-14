import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, contactSources, contactSourceReviews } from "@workspace/db";
import { SourceReviewError } from "./source-review";

const historyInput = z.object({
  sourceId: z.string().trim().min(1).max(200).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).max(10000).default(0),
}).strict();

export const historyUsage = "Usage: history:directory [--source-id <id>] [--limit 1..100] [--offset 0..10000]";

export function parseHistoryArgs(args: string[]) {
  const options: Record<string, unknown> = {};
  const names: Record<string, string> = { "--source-id": "sourceId", "--limit": "limit", "--offset": "offset" };
  for (let i = 0; i < args.length; i += 2) {
    const key = names[args[i]!];
    const value = args[i + 1];
    if (!key || value === undefined || value.startsWith("--") || key in options) {
      throw new SourceReviewError(historyUsage);
    }
    if (key !== "sourceId" && !/^\d+$/.test(value)) throw new SourceReviewError(historyUsage);
    options[key] = key === "sourceId" ? value : Number(value);
  }
  return historyInput.parse(options);
}

const snapshotReview = z.object({
  source: z.object({ reviewedAt: z.string().datetime({ offset: true }) }),
});

// Maintenance-only: never import this module into an anonymous HTTP route.
export async function listReviewHistory(
  input: z.input<typeof historyInput> = {},
  database: Pick<typeof db, "select"> = db,
) {
  const { sourceId, limit, offset } = historyInput.parse(input);
  if (sourceId !== undefined) {
    const [source] = await database.select({ id: contactSources.id }).from(contactSources)
      .where(eq(contactSources.id, sourceId)).limit(1);
    if (!source) throw new SourceReviewError("Source not found");
  }
  // Fetch only one bounded page plus a lookahead. Break timestamp ties by unique ID.
  const rows = await database.select().from(contactSourceReviews)
    .where(sourceId === undefined ? undefined : eq(contactSourceReviews.sourceId, sourceId))
    .orderBy(desc(contactSourceReviews.recordedAt), desc(contactSourceReviews.id))
    .limit(limit + 1).offset(offset);
  const items = rows.slice(0, limit).map((row) => ({
    ...row,
    // The review happened at this time; recordedAt is when it entered the audit log.
    reviewedAt: snapshotReview.parse(row.after).source.reviewedAt,
  }));
  return {
    items, sourceId: sourceId ?? null, limit, offset,
    nextOffset: rows.length > limit && offset + limit <= 10000 ? offset + limit : null,
  };
}
