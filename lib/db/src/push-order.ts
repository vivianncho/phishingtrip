// drizzle-kit 0.31 emits self-referencing FKs before new unique indexes.
// Its introspection also hides indexes referenced by FKs, so a later push
// may try to recreate this same index. PostgreSQL still validates the FK.
// Change only this prerequisite, keeping all other schema operations in order.
export function orderPropertyBrandStatements(statements: string[]) {
  const ordered = statements.map((statement) => statement.replace(
    /^CREATE UNIQUE INDEX "companies_brand_identity_unique"/i,
    'CREATE UNIQUE INDEX IF NOT EXISTS "companies_brand_identity_unique"',
  ));
  const index = ordered.findIndex((statement) =>
    /^CREATE UNIQUE INDEX IF NOT EXISTS "companies_brand_identity_unique"/i.test(statement.trim()));
  const reference = ordered.findIndex((statement) =>
    /ADD CONSTRAINT "companies_property_brand_fk" FOREIGN KEY/i.test(statement));
  if (index < 0 || reference < 0 || index < reference) return ordered;
  const [createIndex] = ordered.splice(index, 1);
  ordered.splice(reference, 0, createIndex!);
  return ordered;
}
