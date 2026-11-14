import test from "node:test";
import assert from "node:assert/strict";
import { orderPropertyBrandStatements } from "./push-order";

const index = 'CREATE UNIQUE INDEX "companies_brand_identity_unique" ON "companies" ("id","listing_type","category");';
const safeIndex = index.replace("CREATE UNIQUE INDEX", "CREATE UNIQUE INDEX IF NOT EXISTS");
const reference = 'ALTER TABLE "companies" ADD CONSTRAINT "companies_property_brand_fk" FOREIGN KEY ("brand_id","property_brand_type","category") REFERENCES "companies" ("id","listing_type","category");';
test("the property's unique index is applied before its FK without reordering other operations", () => {
  const input = ["add columns", reference, "add check", index, "other operation"];
  assert.deepEqual(orderPropertyBrandStatements(input), ["add columns", safeIndex, reference, "add check", "other operation"]);
  assert.deepEqual(input, ["add columns", reference, "add check", index, "other operation"]);
  assert.deepEqual(orderPropertyBrandStatements([index]), [safeIndex]);
  assert.deepEqual(orderPropertyBrandStatements([index, reference]), [safeIndex, reference]);
  for (const alreadySafe of [[], [safeIndex], [reference], [safeIndex, reference], ["other operation"]]) {
    assert.deepEqual(orderPropertyBrandStatements(alreadySafe), alreadySafe);
  }
});
