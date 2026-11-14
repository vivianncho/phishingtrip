import assert from "node:assert/strict";
import test from "node:test";
import { assertApiAccess } from "./check-api-access.mjs";

test("API access readiness requires explicitly verified restricted permissions", async () => {
  await assertApiAccess({ query: async () => ({ rows: [{ ready: true }] }) });
  for (const rows of [[], [{ ready: false }], [{ ready: null }]]) {
    await assert.rejects(assertApiAccess({ query: async () => ({ rows }) }), /not ready/);
  }
});

test("missing roles and denied connections fail without retrying as the owner", async () => {
  let attempts = 0;
  await assert.rejects(assertApiAccess({
    query: async () => { attempts++; throw new Error("role does not exist"); },
  }), /role does not exist/);
  assert.equal(attempts, 1);
});
