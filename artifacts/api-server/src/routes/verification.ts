import { Router, type IRouter } from "express";
import {
  CheckNumberBody, CheckNumberResponse, ListCompaniesQueryParams, ListCompaniesResponse,
  GetCompanyParams, GetCompanyResponse, GetCapabilitiesResponse, GetTravelSafetyResponse,
} from "@workspace/api-zod";
import type { Directory } from "../verification/directory";
import type { MetadataProvider } from "../verification/twilio";
import { ApiFault, limitations, SOURCE_MAX_AGE_DAYS, CACHE_MAX_ENTRIES, CACHE_TTL_SECONDS } from "../verification/policy";
import { normalize } from "../verification/normalize";
import { decide } from "../verification/decision";
import { guidanceFor, travelSafety } from "../verification/travel-safety";

export function verificationRouter(directory: Directory, provider: MetadataProvider): IRouter {
  const router = Router();
  router.get("/travel-safety", (_req, res) => {
    res.json(GetTravelSafetyResponse.parse(travelSafety));
  });
  router.get("/capabilities", async (_req, res): Promise<void> => {
    let directoryStatus: "active" | "unavailable" = "active";
    try { await directory.list("", undefined, 1, 0); } catch { directoryStatus = "unavailable"; }
    res.json(GetCapabilitiesResponse.parse({
      providers: { directory: directoryStatus, reputation: "unavailable", metadata: provider.status() },
      limitations, reputationReportsAvailable: false, sourceMaxAgeDays: SOURCE_MAX_AGE_DAYS,
      metadataCacheTtlSeconds: CACHE_TTL_SECONDS, metadataCacheMaxEntries: CACHE_MAX_ENTRIES,
      checkedAt: new Date().toISOString(),
    }));
  });
  router.get("/companies", async (req, res): Promise<void> => {
    const parsed = ListCompaniesQueryParams.strict().safeParse(req.query);
    // Generated coercion must not accept arrays or object-shaped query values.
    if (!parsed.success || Object.values(req.query).some((v) => typeof v !== "string")) throw new ApiFault(400, "INVALID_INPUT", "Invalid directory query.");
    const { search = "", category, limit = 20, offset = 0, ...filters } = parsed.data;
    const page = await directory.list(search, category, limit, offset, filters);
    res.json(ListCompaniesResponse.parse({ ...page, limit, offset, nextOffset: offset + limit < page.total ? offset + limit : null }));
  });
  router.get("/companies/:id", async (req, res): Promise<void> => {
    const parsed = GetCompanyParams.safeParse(req.params);
    if (!parsed.success) throw new ApiFault(400, "INVALID_INPUT", "Invalid company ID.");
    const company = await directory.get(parsed.data.id);
    if (!company) throw new ApiFault(404, "COMPANY_NOT_FOUND", "Company not found.");
    res.json(GetCompanyResponse.parse(company));
  });
  router.post("/checks", async (req, res): Promise<void> => {
    if (!req.is("application/json")) throw new ApiFault(415, "UNSUPPORTED_MEDIA_TYPE", "Use application/json.");
    const parsed = CheckNumberBody.strict().safeParse(req.body);
    if (!parsed.success) throw new ApiFault(400, "INVALID_INPUT", "Invalid check input.");
    const { phoneNumber, defaultCountry, claimedCompanyId, claimedService } = parsed.data;
    const normalized = normalize(phoneNumber, defaultCountry);
    const company = claimedCompanyId ? await directory.get(claimedCompanyId) : null;
    if (claimedCompanyId && !company) throw new ApiFault(404, "COMPANY_NOT_FOUND", "Company not found.");
    const matches = await directory.matching(normalized.number);
    const result = decide(normalized.number, claimedCompanyId, matches, company?.contacts ?? matches, [], Date.now(), claimedService);
    const lookup = await provider.lookup(normalized.number);
    res.json(CheckNumberResponse.parse({
      ...result, normalizedNumber: normalized.number, countryCode: normalized.countryCode,
      claimedCompanyId: claimedCompanyId ?? null, checkedAt: new Date().toISOString(), limitations,
      claimedService: claimedService ?? null,
      providers: { directory: "active", reputation: "unavailable", metadata: lookup.status }, metadata: lookup.metadata,
      ...(company ? { travelGuidance: guidanceFor(company.category) } : {}),
    }));
  });
  return router;
}
