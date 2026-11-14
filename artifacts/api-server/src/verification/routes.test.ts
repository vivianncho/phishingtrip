import test, { after } from "node:test";
import assert from "node:assert/strict";
import { Writable } from "node:stream";
import pino from "pino";
import request from "supertest";
import { Router } from "express";
import { pool } from "@workspace/db";
import { CheckNumberResponse, GetCapabilitiesResponse, GetCompanyResponse, ListCompaniesResponse, GetTravelSafetyResponse } from "@workspace/api-zod";
import { createApp } from "../app";
import healthRouter from "../routes/health";
import { verificationRouter } from "../routes/verification";
import { directory, type Directory } from "./directory";
import type { MetadataProvider } from "./twilio";

const silent = pino({ level: "silent" });
const disabled: MetadataProvider = { status: () => "disabled", lookup: async () => ({ status: "disabled", metadata: null }) };
function appFor(d: Directory = directory, provider = disabled) {
  const router = Router().use(healthRouter).use(verificationRouter(d, provider));
  return createApp({ router, logger: silent });
}
after(async () => { await pool.end(); });

test("health, capabilities and real sourced directory validate against shared schemas", async () => {
  const app = appFor();
  assert.deepEqual((await request(app).get("/api/healthz").expect(200)).body, { status: "ok" });
  const cap = (await request(app).get("/api/capabilities").expect(200)).body;
  GetCapabilitiesResponse.parse(cap);
  assert.equal(cap.providers.directory, "active");
  assert.equal(cap.providers.metadata, "disabled");
  assert.equal(cap.reputationReportsAvailable, false);
  const page = (await request(app).get("/api/companies?category=airline&limit=2&offset=0").expect(200)).body;
  ListCompaniesResponse.parse(page);
  assert.ok(page.total >= 3);
  assert.equal(page.items.length, 2);
  assert.equal(page.nextOffset, 2);
  assert.deepEqual([...page.items.map((c: { id: string }) => c.id)].sort(), page.items.map((c: { id: string }) => c.id));
  const next = (await request(app).get("/api/companies?limit=2&offset=2").expect(200)).body;
  assert.ok(!page.items.map((c: { id: string }) => c.id).includes(next.items[0].id));
  const found = (await request(app).get("/api/companies?search=DELTA").expect(200)).body;
  assert.equal(found.items[0].id, "delta");
  assert.equal((await request(app).get("/api/companies?search=%25").expect(200)).body.total, 0);
  assert.equal((await request(app).get("/api/companies?offset=10000").expect(200)).body.nextOffset, null);
  for (const id of ["delta", "united", "american"]) {
    const company = (await request(app).get(`/api/companies/${id}`).expect(200)).body;
    GetCompanyResponse.parse(company);
    assert.ok(company.contacts.length > 0);
    const source = company.contacts[0].sources[0];
    assert.equal(new URL(source.sourceUrl).hostname, new URL(company.website).hostname);
    assert.equal(source.reviewedAt, "2026-11-14T20:34:24.000Z");
  }
});
test("route checks exact normalized evidence, wrong company, ambiguity and no real reports", async () => {
  const app = appFor();
  const international = (await request(app).post("/api/checks").send({ phoneNumber: "+1 (800) 221-1212", claimedCompanyId: "delta" }).expect(200)).body;
  CheckNumberResponse.parse(international);
  assert.equal(international.normalizedNumber, "+18002211212");
  // Tests remain conservative after real directory review expiry.
  assert.equal(international.outcome, Date.now() < Date.parse("2027-02-12T20:34:24Z") ? "official_match" : "not_verified");
  const national = (await request(app).post("/api/checks").send({ phoneNumber: "8002211212", defaultCountry: "US" }).expect(200)).body;
  assert.equal(national.normalizedNumber, international.normalizedNumber);
  const wrong = (await request(app).post("/api/checks").send({ phoneNumber: "+18002211212", claimedCompanyId: "united" }).expect(200)).body;
  assert.equal(wrong.reason, "COMPANY_MISMATCH");
  assert.notEqual(wrong.outcome, "official_match");
  if (wrong.alternatives.length) assert.equal(wrong.alternatives[0].companyId, "united");
  const unknown = (await request(app).post("/api/checks").send({ phoneNumber: "+442079460018" }).expect(200)).body;
  assert.equal(unknown.outcome, "not_verified");
  assert.equal(unknown.metadata, null);
  assert.equal(unknown.providers.reputation, "unavailable");
  assert.equal(unknown.evidence.some((e: { kind: string }) => e.kind === "reputation_report"), false);
  const ambiguous = await request(app).post("/api/checks").send({ phoneNumber: "8002211212" }).expect(400);
  assert.equal(ambiguous.body.code, "COUNTRY_REQUIRED");
});
test("travel categories filter actual directory rows and sourced contacts match beyond airlines", async () => {
  const app = appFor();
  const cases = [
    ["hotel", "marriott", "+18882362427"],
    ["vacation_rental", "marriott-homes-villas", "+18337642004"],
    ["car_rental", "enterprise", "+18552669289"],
    ["rail_transfer", "amtrak", "+18008727245"],
    ["cruise", "royal-caribbean", "+18665627625"],
    ["booking_service", "booking", null],
    ["tour", "viator", null],
  ] as const;
  for (const [category, id, number] of cases) {
    const page = (await request(app).get(`/api/companies?category=${category}`).expect(200)).body;
    ListCompaniesResponse.parse(page);
    assert.ok(page.items.some((c: { id: string }) => c.id === id));
    assert.ok(page.items.every((c: { category: string }) => c.category === category));
    const company = (await request(app).get(`/api/companies/${id}`).expect(200)).body;
    GetCompanyResponse.parse(company);
    if (!number) assert.equal(company.contacts.length, 0);
    const checked = (await request(app).post("/api/checks").send({
      phoneNumber: number ?? "+442079460018", claimedCompanyId: id,
    }).expect(200)).body;
    CheckNumberResponse.parse(checked);
    const current = Date.now() < Date.parse("2027-02-12T20:46:23Z");
    assert.equal(checked.outcome, number && current ? "official_match" : "not_verified");
    assert.equal(checked.travelGuidance.category, category);
    assert.equal(checked.providers.reputation, "unavailable");
    assert.ok(!checked.evidence.some((e: { kind: string }) => e.kind === "reputation_report"));
    const unknown = (await request(app).post("/api/checks").send({
      phoneNumber: "+442079460018", claimedCompanyId: id,
    }).expect(200)).body;
    assert.equal(unknown.outcome, "not_verified");
    assert.equal(unknown.reason, "NO_EVIDENCE");
    assert.equal(unknown.travelGuidance.category, category);
    if (number && current) assert.equal(unknown.alternatives[0].companyId, id);
    else assert.equal(unknown.alternatives.length, 0);
  }
  const mismatch = (await request(app).post("/api/checks").send({
    phoneNumber: "+18002211212", claimedCompanyId: "marriott",
  }).expect(200)).body;
  assert.equal(mismatch.reason, "COMPANY_MISMATCH");
  assert.equal(mismatch.outcome, "not_verified");
});
test("travel scam guidance is educational, covers every category, and is not report evidence", async () => {
  const app = appFor();
  const guides = (await request(app).get("/api/travel-safety").expect(200)).body;
  GetTravelSafetyResponse.parse(guides);
  assert.equal(guides.length, 8);
  assert.equal(new Set(guides.map((g: { category: string }) => g.category)).size, 8);
  for (const guide of guides) {
    assert.match(guide.sourceUrl, /^https:\/\/consumer\.ftc\.gov\//);
    assert.match(guide.disclaimer, /not a report/);
    assert.ok(guide.warningSigns.length > 0);
    assert.ok(guide.nextSteps.length > 0);
  }
  const unknown = (await request(app).post("/api/checks").send({ phoneNumber: "+442079460018" }).expect(200)).body;
  assert.equal(unknown.travelGuidance, undefined);
  assert.equal(unknown.outcome, "not_verified");
});
test("hotel properties have exact official local contacts and searchable location identities", async () => {
  const app = appFor();
  const expected = [
    { id: "marriott-nycmq", city: "New York", code: "NYCMQ", number: "+12123981900", address: "1535 Broadway" },
    { id: "marriott-sfodt", city: "San Francisco", code: "SFODT", number: "+14158961600", address: "780 Mission Street" },
  ];
  const page = (await request(app).get("/api/companies?category=hotel&listingType=property&brandId=marriott&countryCode=US&limit=1").expect(200)).body;
  ListCompaniesResponse.parse(page);
  assert.equal(page.total, 2);
  assert.equal(page.items.length, 1);
  assert.equal(page.nextOffset, 1);
  const next = (await request(app).get("/api/companies?category=hotel&listingType=property&brandId=marriott&countryCode=US&limit=1&offset=1").expect(200)).body;
  assert.notEqual(page.items[0].id, next.items[0].id);
  assert.equal(next.nextOffset, null);
  for (const property of expected) {
    const company = (await request(app).get(`/api/companies/${property.id}`).expect(200)).body;
    GetCompanyResponse.parse(company);
    assert.equal(company.listingType, "property");
    assert.equal(company.brandId, "marriott");
    assert.equal(company.propertyCode, property.code);
    assert.equal(company.countryCode, "US");
    assert.equal(company.city, property.city);
    assert.ok(company.address.startsWith(property.address));
    assert.equal(company.contacts.length, 1);
    const contact = company.contacts[0];
    assert.equal(contact.number, property.number);
    assert.equal(contact.companyId, property.id);
    assert.equal(contact.serviceType, "property_main");
    assert.match(contact.service, /front-desk service not confirmed/);
    assert.ok(contact.region.includes(property.city));
    assert.equal(contact.sources[0].number, property.number);
    assert.equal(contact.sources[0].reviewedAt, "2026-11-14T20:49:15.000Z");
    assert.ok(contact.sources[0].sourceUrl.includes(`/hotels/${property.code.toLowerCase()}-`));
    assert.equal(new URL(contact.sources[0].sourceUrl).hostname, "www.marriott.com");
    for (const term of [property.code.toLowerCase(), property.address]) {
      const found = (await request(app).get("/api/companies").query({ listingType: "property", search: term }).expect(200)).body;
      assert.deepEqual(found.items.map((c: { id: string }) => c.id), [property.id]);
    }
    const city = (await request(app).get("/api/companies").query({ brandId: "marriott", city: property.city.toLowerCase(), countryCode: "US" }).expect(200)).body;
    assert.deepEqual(city.items.map((c: { id: string }) => c.id), [property.id]);
  }
  for (const query of [
    { listingType: "property", search: "Unknown Marriott Hotel" },
    { listingType: "property", city: "Unknown city" },
    { listingType: "property", brandId: "unknown-brand" },
    { listingType: "property", countryCode: "GB" },
    { listingType: "property", city: "%" },
  ]) {
    const empty = (await request(app).get("/api/companies").query(query).expect(200)).body;
    assert.equal(empty.total, 0);
    assert.deepEqual(empty.items, []);
    assert.equal(empty.nextOffset, null);
  }
  const brand = (await request(app).get("/api/companies?listingType=brand&category=hotel").expect(200)).body;
  assert.deepEqual(brand.items.map((c: { id: string }) => c.id), ["marriott"]);
  assert.equal(brand.items[0].contacts[0].serviceType, "central_reservations");
  await request(app).get("/api/companies/marriott-unknown-property").expect(404);
});
test("hotel checks never substitute another property, central reservations or a main line for a front desk", async () => {
  const app = appFor();
  const check = async (phoneNumber: string, claimedCompanyId: string, claimedService?: string) => {
    const response = (await request(app).post("/api/checks").send({ phoneNumber, claimedCompanyId, claimedService }).expect(200)).body;
    CheckNumberResponse.parse(response);
    return response;
  };
  const current = Date.now() >= Date.parse("2026-11-14T20:49:15Z") && Date.now() < Date.parse("2027-02-12T20:49:15Z");
  const right = await check("+12123981900", "marriott-nycmq", "property_main");
  assert.equal(right.reason, current ? "EXACT_OFFICIAL_MATCH" : "STALE_EVIDENCE");
  assert.equal(right.claimedService, "property_main");
  assert.equal((await check("+14158961600", "marriott-sfodt")).outcome, current ? "official_match" : "not_verified");
  for (const [number, id] of [
    ["+12123981900", "marriott-sfodt"], ["+14158961600", "marriott-nycmq"],
    ["+18882362427", "marriott-nycmq"], ["+12123981900", "marriott"],
  ]) {
    const mismatch = await check(number!, id!);
    assert.equal(mismatch.reason, "COMPANY_MISMATCH");
    assert.equal(mismatch.outcome, "not_verified");
    assert.ok(mismatch.alternatives.every((c: { companyId: string }) => c.companyId === id));
  }
  for (const [number, id, service] of [
    ["+18882362427", "marriott", "front_desk"],
    ["+12123981900", "marriott-nycmq", "front_desk"],
    ["+12123981900", "marriott-nycmq", "central_reservations"],
  ]) {
    const mismatch = await check(number!, id!, service);
    assert.equal(mismatch.reason, "SERVICE_MISMATCH");
    assert.equal(mismatch.outcome, "not_verified");
    assert.deepEqual(mismatch.alternatives, []);
  }
  const unknown = await check("+442079460018", "marriott-nycmq", "property_main");
  assert.equal(unknown.reason, "NO_EVIDENCE");
  assert.ok(unknown.alternatives.every((c: { companyId: string; serviceType: string }) => c.companyId === "marriott-nycmq" && c.serviceType === "property_main"));
  await request(app).post("/api/checks").send({ phoneNumber: "+18882362427", claimedCompanyId: "marriott-unknown-property" }).expect(404);
  for (const query of ["listingType=front_desk", "brandId=INVALID", "city=", "countryCode=usa", "city=x&city=y", "listingType[property]=x"]) {
    await request(app).get(`/api/companies?${query}`).expect(400);
  }
  await request(app).post("/api/checks").send({ phoneNumber: "+12123981900", claimedService: "anything" }).expect(400);
});
test("invalid inputs, IDs, queries, body limits and unsupported types have safe standard errors", async () => {
  const app = appFor();
  for (const query of ["limit=0", "limit=51", "limit=1.5", "offset=-1", "offset=10001", "category=bank", "search=" + "x".repeat(81), "limit=1&limit=2", "search[x]=secret", "unknown=x"]) {
    const r = await request(app).get(`/api/companies?${query}`).expect(400);
    assert.equal(r.body.code, "INVALID_INPUT");
  }
  await request(app).get("/api/companies/INVALID").expect(400);
  await request(app).get("/api/companies/not-in-directory").expect(404);
  await request(app).post("/api/checks").send({ phoneNumber: "+18002211212", claimedCompanyId: "not-in-directory" }).expect(404);
  for (const body of [{}, { phoneNumber: 12345 }, { phoneNumber: "x".repeat(65) }, { phoneNumber: "+18002211212", browsingUrl: "private" }, { phoneNumber: "+18002211212", defaultCountry: "us" }]) {
    await request(app).post("/api/checks").send(body).expect(400);
  }
  await request(app).post("/api/checks").send({ phoneNumber: "x".repeat(3000) }).expect(413);
  await request(app).post("/api/checks").type("text").send("+18002211212").expect(415);
  await request(app).post("/api/checks").set("Content-Type", "application/json").send('{"phoneNumber":').expect(400);
  await request(app).get("/api/checks").expect(404);
  await request(app).post("/api/companies").send({}).expect(404);
});
test("provider failures and missing coverage do not erase directory evidence or create fraud claims", async () => {
  const number = "+18002211212", time = Date.now();
  const c = { id: "contact", companyId: "test", number, region: "Test", service: "Fixture", serviceType: "general" as const, freshness: "current" as const, sources: [{
    id: "source", companyId: "test", kind: "official_contact" as const, number, sourceUrl: "https://fixture.example", sourceName: "Fixture",
    reviewedAt: new Date(time - 1000).toISOString(), expiresAt: new Date(time + 86400000).toISOString(), assertion: "listed" as const, freshness: "current" as const,
  }] };
  const fixture: Directory = { get: async () => null, list: async () => ({ items: [], total: 0 }), matching: async () => [c] };
  for (const status of ["timeout", "unavailable", "invalid_response", "budget_exhausted", "not_configured"] as const) {
    const app = appFor(fixture, { status: () => status, lookup: async () => ({ status, metadata: null }) });
    const r = (await request(app).post("/api/checks").send({ phoneNumber: number }).expect(200)).body;
    assert.equal(r.outcome, "official_match");
    assert.equal(r.providers.metadata, status);
    assert.equal(r.evidence.length, 1);
  }
  const broken: Directory = {
    get: async () => { throw new Error("private database details"); },
    list: async () => { throw new Error("private database details"); },
    matching: async () => { throw new Error("private database details"); },
  };
  const unavailable = appFor(broken);
  assert.equal((await request(unavailable).get("/api/capabilities").expect(200)).body.providers.directory, "unavailable");
  const failure = await request(unavailable).post("/api/checks").send({ phoneNumber: number }).expect(503);
  assert.equal(JSON.stringify(failure.body).includes("private"), false);
});
test("rate limits ignore spoofed forwarded addresses and CORS only permits explicit origins", async () => {
  const router = Router().use(healthRouter).use(verificationRouter(directory, disabled));
  const app = createApp({ router, logger: silent, rateMax: 2, origins: ["https://client.example"] });
  await request(app).get("/api/capabilities").set("X-Forwarded-For", "192.0.2.1").expect(200);
  await request(app).get("/api/capabilities").set("X-Forwarded-For", "192.0.2.2").expect(200);
  const limited = await request(app).get("/api/capabilities").set("X-Forwarded-For", "192.0.2.3").expect(429);
  assert.ok(limited.headers["retry-after"]);
  await request(app).get("/api/healthz").expect(200);
  const allowed = await request(appFor()).get("/api/healthz").set("Origin", "https://untrusted.example");
  assert.equal(allowed.headers["access-control-allow-origin"], undefined);
  const configured = await request(createApp({ router, logger: silent, origins: ["https://client.example"] })).options("/api/checks").set("Origin", "https://client.example").set("Access-Control-Request-Method", "POST").expect(204);
  assert.equal(configured.headers["access-control-allow-origin"], "https://client.example");
});
test("trust-all and numeric-hop proxy configurations are rejected", () => {
  const previous = process.env.TRUSTED_PROXY_CIDRS;
  try {
    for (const cidr of ["0.0.0.0/0", "0.0.0.0/00", "::/0", "true", "1"]) {
      process.env.TRUSTED_PROXY_CIDRS = cidr;
      assert.throws(() => createApp({ logger: silent }));
    }
  } finally {
    if (previous === undefined) delete process.env.TRUSTED_PROXY_CIDRS;
    else process.env.TRUSTED_PROXY_CIDRS = previous;
  }
});
test("sensitive body, query, path, headers, parser errors and upstream errors never enter app logs", async () => {
  let logs = "";
  const stream = new Writable({ write(chunk, _encoding, callback) { logs += chunk.toString(); callback(); } });
  const captured = pino({}, stream);
  const broken: Directory = { list: async () => { throw new Error("UPSTREAM_PRIVATE_TOKEN"); }, get: async () => null, matching: async () => [] };
  const router = Router().use(verificationRouter(broken, disabled));
  const app = createApp({ router, logger: captured, rateMax: 20 });
  const headers = { Authorization: "Bearer PRIVATE_AUTH_TOKEN", Cookie: "PRIVATE_SESSION_COOKIE" };
  const malformed = await request(app).post("/api/checks?search=PRIVATE_SEARCH").set(headers).set("Content-Type", "application/json").send('{"phoneNumber":"+18002211212","page":"PRIVATE_PAGE"').expect(400);
  const failure = await request(app).get("/api/companies?search=PRIVATE_SEARCH").set(headers).expect(503);
  await request(app).get("/api/PRIVATE_PATH_NUMBER").set(headers).expect(404);
  const text = logs + JSON.stringify([malformed.body, failure.body]);
  for (const secret of ["PRIVATE_AUTH_TOKEN", "PRIVATE_SESSION_COOKIE", "PRIVATE_SEARCH", "PRIVATE_PAGE", "PRIVATE_PATH_NUMBER", "UPSTREAM_PRIVATE_TOKEN", "+18002211212", "phoneNumber", "stack"]) assert.equal(text.includes(secret), false, secret);
  assert.equal(malformed.headers["cache-control"], "no-store");
});
