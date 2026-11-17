import { isIP } from "node:net";
import { apiOrigin, apiRequest, capabilities } from "../src/core.js";

export async function verifyReleaseService(value, fetcher = fetch) {
  if (!value) throw new Error("Release blocked: set apiOrigin in release.json to an approved public HTTPS checking service. Do not use a private deployment or bypass token.");
  const origin = apiOrigin(value);
  const { hostname } = new URL(origin);
  if (!hostname.includes(".") || isIP(hostname.replace(/^\[|\]$/g, "")) ||
      /\.(?:replit\.dev|localhost|local|internal)$/.test(hostname)) {
    throw new Error("Release blocked: use a published public service, not a development preview, local host or IP address.");
  }
  try {
    // No number, Google search, cookies, tokens or redirect following.
    capabilities(await apiRequest(origin, "/capabilities", { fetcher, timeout: 8000 }));
  } catch {
    throw new Error("Release blocked: the service must return valid public capabilities without login, redirects or private access tokens. Deployment visibility was not changed.");
  }
  return origin;
}
