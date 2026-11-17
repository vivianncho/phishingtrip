import test from "node:test";
import assert from "node:assert/strict";
import { verifyReleaseService } from "../scripts/release-service.mjs";

const capabilities = () => ({
  checkedAt: new Date().toISOString(),
  providers: { directory: "active", reputation: "unavailable", metadata: "disabled" },
  reputationReportsAvailable: false,
  limitations: ["No result guarantees safety."],
});
test("consumer release requires a public non-preview HTTPS service", async () => {
  let calls = 0;
  const fake = async () => { calls++; return Response.json(capabilities()); };
  for (const value of ["", "http://example.com", "https://foo.replit.dev", "https://127.0.0.2", "https://10.0.0.1", "https://private.local", "https://user:secret@example.com", "https://example.com?token=secret"]) {
    await assert.rejects(verifyReleaseService(value, fake));
  }
  assert.equal(calls, 0);
});
test("release probe sends no phone number or credentials and rejects gated or incompatible services", async () => {
  const origin = await verifyReleaseService("https://service.example", async (url, opts) => {
    assert.equal(url, "https://service.example/api/capabilities");
    assert.equal(opts.method, "GET");
    assert.equal(opts.credentials, "omit");
    assert.equal(opts.redirect, "error");
    assert.equal(opts.body, undefined);
    assert.equal(opts.headers.Authorization, undefined);
    return Response.json(capabilities());
  });
  assert.equal(origin, "https://service.example");
  for (const response of [new Response("", { status: 401 }), new Response("<html>sign in</html>", { headers: { "content-type": "text/html" } }), Response.json({ success: true })]) {
    await assert.rejects(verifyReleaseService("https://private.example", async () => response), /Release blocked/);
  }
});
