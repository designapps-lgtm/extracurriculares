import { Router } from "express";
import { asyncHandler } from "../../middlewares/errorHandler";
import { bootstrap, syncNow, webhook } from "./driveSync.controller";

const router = Router();

router.post("/google-drive", asyncHandler(webhook));
router.post("/google-drive/bootstrap", asyncHandler(bootstrap));
router.post("/google-drive/sync", asyncHandler(syncNow));

export { router as driveSyncRouter };
