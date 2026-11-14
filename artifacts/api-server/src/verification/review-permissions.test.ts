import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import request from "supertest";
import pino from "pino";
import {
  db, pool, apiPool, closeDatabasePools, createRoleDatabase, databaseRoles, companies, officialContacts,
  contactSources, contactSourceReviews,
} from "@workspace/db";
import { recordSourceReview, reviewFingerprint, type ReviewSubject } from "./source-review";
import { listReviewHistory } from "./review-history";
import { createApp } from "../app";
import { PostgresCounters } from "./counters";

const api = createRoleDatabase(databaseRoles.api);
const reviewer = createRoleDatabase(databaseRoles.review);
const historian = createRoleDatabase(databaseRoles.history);
after(async () => {
  await Promise.all([api.pool.end(), reviewer.pool.end(), historian.pool.end(), closeDatabasePools()]);
});

test("non-owner API session serves directory requests and counters without audit access", async () => {
  // A NOLOGIN fixture identity simulates a dedicated authenticated session using
  // SET SESSION AUTHORIZATION: no passwords or additional connection secrets.
  // This check requires the trusted development test administrator.
  const identity = `api_fixture_${randomUUID().replaceAll("-", "")}`;
  assert.match(identity, /^[a-z_0-9]+$/);
  await pool.query(`CREATE ROLE ${identity} NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE`);
  try {
    await pool.query(`GRANT phishing_api TO ${identity}`);
    const client = await apiPool.connect();
    try {
      await client.query(`SET SESSION AUTHORIZATION ${identity}`);
      await client.query("SET ROLE phishing_api");
      const { rows } = await client.query("SELECT current_user, session_user");
      assert.deepEqual(rows[0], { current_user: "phishing_api", session_user: identity });
      await client.query("RESET ROLE");
      await assert.rejects(client.query("SET ROLE phishing_history"), { code: "42501" });
      await assert.rejects(client.query("SET ROLE phishing_review"), { code: "42501" });
      await client.query("SET ROLE phishing_api");
      await assert.rejects(client.query("SELECT note FROM public.contact_source_reviews"), { code: "42501" });
      await assert.rejects(client.query("UPDATE public.contact_source_reviews SET note = note WHERE false"), { code: "42501" });
    } finally {
      client.release();
    }
    // No parallel queries: the default API pool reuses the identity-scoped
    // connection for both actual HTTP counter reservations and directory reads.
    const app = createApp({ logger: pino({ level: "silent" }), counters: new PostgresCounters(identity) });
    const result = await request(app).get("/api/companies?limit=1").expect(200);
    assert.ok(Array.isArray(result.body.items));
    const checked = await apiPool.query("SELECT current_user, session_user");
    assert.equal(checked.rows[0].session_user, identity);
    const counters = await apiPool.query("SELECT used FROM public.usage_counters WHERE namespace = $1", [identity]);
    assert.ok(counters.rows.length > 0);
    // Exercise the exact expiry-cleanup permission without affecting live rows.
    await apiPool.query("DELETE FROM public.usage_counters WHERE namespace = $1", [identity]);
  } finally {
    const client = await apiPool.connect();
    try {
      await client.query("RESET SESSION AUTHORIZATION");
      await client.query("SET ROLE phishing_api");
    } finally { client.release(); }
    await pool.query(`DROP ROLE ${identity}`);
  }
});

// These are real separate PostgreSQL sessions, not SQL mocks. Provision roles
// first with @workspace/db access:configure, using a development DBA connection.
test("separate roles protect private audit history and preserve atomic review writes", async () => {
  const id = `permissions-${randomUUID()}`;
  const now = Date.now() - 5000;
  const subject: ReviewSubject = {
    company: { id, name: "Permission fixture", website: "https://fixture.example", category: "airline",
      listingType: "organization", brandId: null, propertyCode: null, address: null,
      city: null, subdivision: null, countryCode: null, propertyBrandType: null },
    contact: { id, companyId: id, number: "+18002211212", region: "US", service: "Reservations", serviceType: "general" },
    source: { id, contactId: id, sourceName: "Fixture", sourceUrl: "https://fixture.example/contact",
      assertion: "listed", reviewedAt: new Date(now - 86400000), expiresAt: new Date(now) },
  };
  const input = {
    sourceId: id, expectedFingerprint: reviewFingerprint(subject),
    reviewer: "permission-fixture", note: "Private review note; never exposed by anonymous access.",
    confirmedHumanReview: true, number: subject.contact.number, region: "US", service: "Reservations",
    sourceUrl: subject.source.sourceUrl, assertion: "listed",
    reviewedAt: new Date(now).toISOString(), expiresAt: new Date(now + 86400000).toISOString(),
  };
  const denied = async (connection: typeof api, query: string) => {
    const client = await connection.pool.connect();
    try {
      // Even a regression that unexpectedly permits TRUNCATE must not damage
      // existing audit history while checking its permissions.
      await client.query("BEGIN");
      await assert.rejects(client.query(query), { code: "42501" });
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  };
  try {
    await db.transaction(async (tx) => {
      await tx.insert(companies).values(subject.company);
      await tx.insert(officialContacts).values(subject.contact);
      await tx.insert(contactSources).values(subject.source);
    });
    for (const [connection, role] of [
      [api, databaseRoles.api], [reviewer, databaseRoles.review], [historian, databaseRoles.history],
    ] as const) {
      const result = await connection.pool.query("SELECT current_user, session_user");
      assert.equal(result.rows[0].current_user, role);
      assert.notEqual(result.rows[0].current_user, result.rows[0].session_user);
    }
    assert.equal((await api.db.select().from(contactSources).where(eq(contactSources.id, id))).length, 1);
    await denied(api, "SELECT note FROM public.contact_source_reviews");
    await denied(api, "SELECT reviewer, \"before\", \"after\" FROM public.contact_source_reviews");
    await denied(api, "INSERT INTO public.contact_source_reviews DEFAULT VALUES");
    await denied(api, "SELECT public.lock_contact_review_subject('missing')");
    await denied(historian, "INSERT INTO public.contact_source_reviews DEFAULT VALUES");
    await denied(historian, "UPDATE public.contact_sources SET assertion = 'disputed' WHERE false");
    await denied(historian, "SELECT public.lock_contact_review_subject('missing')");
    await denied(reviewer, "SELECT note FROM public.contact_source_reviews");
    await denied(reviewer, "UPDATE public.companies SET name = name WHERE false");
    await denied(reviewer, "UPDATE public.official_contacts SET number = number WHERE false");
    await denied(reviewer, "UPDATE public.contact_sources SET source_name = source_name WHERE false");
    for (const connection of [api, reviewer, historian]) {
      await denied(connection, "UPDATE public.contact_source_reviews SET note = 'changed' WHERE false");
      await denied(connection, "DELETE FROM public.contact_source_reviews WHERE false");
      await denied(connection, "TRUNCATE public.contact_source_reviews");
    }

    // Fail at the audit INSERT after the evidence UPDATE, within a real role
    // transaction. The malformed insert raises a real PostgreSQL constraint error.
    const failingWriter = {
      select: reviewer.db.select.bind(reviewer.db),
      transaction: ((callback) => reviewer.db.transaction((tx) => callback(new Proxy(tx, {
        get(target, key, receiver) {
          if (key === "insert") return () => ({
            values: () => target.execute(sql`INSERT INTO public.contact_source_reviews (id) VALUES (${randomUUID()})`),
          });
          return Reflect.get(target, key, receiver);
        },
      })))) as typeof reviewer.db.transaction,
    };
    await assert.rejects(recordSourceReview(input, failingWriter));
    assert.deepEqual((await db.select().from(contactSources).where(eq(contactSources.id, id)))[0], subject.source);
    assert.equal((await listReviewHistory({ sourceId: id }, historian.db)).items.length, 0);

    const recorded = await recordSourceReview(input, reviewer.db);
    const page = await listReviewHistory({ sourceId: id }, historian.db);
    assert.equal(page.items.length, 1);
    assert.equal(page.items[0]!.id, recorded.auditId);
    assert.equal(page.items[0]!.note, input.note);
    assert.equal(page.items[0]!.reviewer, input.reviewer);
    assert.deepEqual(page.items[0]!.before, JSON.parse(JSON.stringify(subject)));
    assert.equal(page.items[0]!.reviewedAt, input.reviewedAt);
    await assert.rejects(recordSourceReview(input, reviewer.db), /Source changed/);
    assert.equal((await listReviewHistory({ sourceId: id }, historian.db)).items.length, 1);
  } finally {
    // Only the trusted fixture owner can remove these test rows.
    await db.transaction(async (tx) => {
      await tx.delete(contactSourceReviews).where(eq(contactSourceReviews.sourceId, id));
      await tx.delete(contactSources).where(eq(contactSources.id, id));
      await tx.delete(officialContacts).where(eq(officialContacts.id, id));
      await tx.delete(companies).where(eq(companies.id, id));
    });
  }
});
