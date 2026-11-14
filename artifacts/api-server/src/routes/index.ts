import { Router, type IRouter } from "express";
import healthRouter from "./health";
import { verificationRouter } from "./verification";
import { directory } from "../verification/directory";
import { TwilioBasic, lookupConfig } from "../verification/twilio";
import { placesRouter } from "./places";

const router: IRouter = Router();

router.use(healthRouter);
router.use(placesRouter());
router.use(verificationRouter(directory, new TwilioBasic(lookupConfig())));

export default router;
