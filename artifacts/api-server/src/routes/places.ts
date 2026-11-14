import { Router, type IRouter } from "express";
import { SearchTravelPlacesBody } from "@workspace/api-zod";
import { ApiFault } from "../verification/policy";
import { PlacesSearch } from "../verification/places";

export function placesRouter(provider = new PlacesSearch()): IRouter {
  const router = Router();
  router.post("/places/search", async (req, res): Promise<void> => {
    if (!req.is("application/json")) throw new ApiFault(415, "UNSUPPORTED_MEDIA", "Send a JSON search.");
    const parsed = SearchTravelPlacesBody.strict().safeParse(req.body);
    const query = parsed.success ? parsed.data.query.trim() : "";
    if (!parsed.success || query.length < 3 || /[\u0000-\u001f\u007f]/.test(query)) {
      throw new ApiFault(400, "INVALID_INPUT", "Enter a business name and city, or a full international number. Use 3–120 characters.");
    }
    try {
      res.json(await provider.search(query));
    } catch (error) {
      if (error instanceof ApiFault && error.code === "PLACES_DAILY_LIMIT") {
        const now = Date.now();
        res.setHeader("Retry-After", Math.max(1, Math.ceil(((Math.floor(now / 86400000) + 1) * 86400000 - now) / 1000)));
      }
      throw error;
    }
  });
  return router;
}
