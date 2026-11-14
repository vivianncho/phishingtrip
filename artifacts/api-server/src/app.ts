import express, { type Express, type ErrorRequestHandler, type Router } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { ipKeyGenerator } from "express-rate-limit";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import type { Logger } from "pino";
import router from "./routes";
import { logger } from "./lib/logger";
import { ApiFault, boundedInt } from "./verification/policy";
import { apiCounters, type Counters } from "./verification/counters";

export function createApp(options: { router?: Router; logger?: Logger; rateMax?: number; origins?: string[]; counters?: Counters } = {}): Express {
  const app = express();
  app.disable("x-powered-by");
  // Never trust arbitrary X-Forwarded-For or numeric hop counts. Direct connections are the default.
  const trusted = process.env.TRUSTED_PROXY_CIDRS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  for (const cidr of trusted) {
    const [ip, prefix, extra] = cidr.split("/");
    const version = isIP(ip ?? "");
    if (!version || extra || prefix !== undefined && (!/^\d+$/.test(prefix) || Number(prefix) > (version === 4 ? 32 : 128))) throw new Error("Invalid trusted proxy configuration");
    if (prefix !== undefined && Number(prefix) === 0) throw new Error("Do not trust every proxy");
  }
  app.set("trust proxy", trusted.length ? trusted : false);
  app.use(
  pinoHttp({
    logger: options.logger ?? logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
      // Body parser errors can contain submitted input; never serialize Error objects.
      err() { return { type: "RequestError" }; },
    },
  }),
);
  app.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
  });
  const origins = options.origins ?? process.env.CORS_ORIGINS?.split(",").map((v) => v.trim()).filter(Boolean) ?? [];
  for (const origin of origins) {
    const parsed = new URL(origin);
    if (parsed.origin !== origin || !["http:", "https:"].includes(parsed.protocol)) throw new Error("Invalid CORS origin configuration");
  }
  app.use(cors({
    origin(origin, callback) {
      // Same-origin and native clients work without CORS configuration. Cross-origin browsers need an allowlist.
      callback(null, !!origin && origins.includes(origin));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept"],
    credentials: false,
    maxAge: 600,
  }));
  const counters = options.counters ?? apiCounters;
  const rateMax = options.rateMax ?? boundedInt(process.env.API_RATE_LIMIT, 60, 300);
  app.use("/api", async (req, res, next): Promise<void> => {
    if (req.path === "/healthz") { next(); return; }
    // Stable across replicas/restarts. No raw address is sent to the store.
    const secret = process.env.SESSION_SECRET;
    if (!secret) { next(new Error("Shared limits unavailable")); return; }
    try {
      // Reserve global first so arbitrary clients cannot grow address buckets without bound.
      let result = await counters.check([{ key: "global", limit: 600, amount: 1, windowMs: 60000 }], true);
      if (result.allowed) {
        const key = createHmac("sha256", secret).update("stillwater:abuse:").update(ipKeyGenerator(req.ip ?? "unknown")).digest("hex");
        result = await counters.check([{ key, limit: rateMax, amount: 1, windowMs: 60000 }], true);
      }
      if (!result.allowed) {
        res.setHeader("Retry-After", result.retryAfter);
        res.status(429).json({ code: "RATE_LIMITED", message: "Too many requests. Try again later." });
        return;
      }
      next();
    } catch { next(new Error("Shared limits unavailable")); }
  });
  app.use(express.json({ limit: "2kb", strict: true }));
  app.use("/api", options.router ?? router);
  app.use((_req, res) => { res.status(404).json({ code: "NOT_FOUND", message: "Endpoint not found." }); });
  const errors: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    if (error instanceof ApiFault) {
      res.status(error.status).json({ code: error.code, message: error.message });
      return;
    }
    const type = error && typeof error === "object" && "type" in error ? error.type : null;
    if (type === "entity.too.large") { res.status(413).json({ code: "BODY_TOO_LARGE", message: "JSON body must not exceed 2 KiB." }); return; }
    if (error instanceof URIError || type === "entity.parse.failed" || type === "encoding.unsupported" || type === "charset.unsupported") { res.status(400).json({ code: "INVALID_INPUT", message: "Invalid request encoding or JSON." }); return; }
    res.status(503).json({ code: "DIRECTORY_UNAVAILABLE", message: "Evidence service unavailable. Try again later." });
  };
  app.use(errors);
  return app;
}

export default createApp();
