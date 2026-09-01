import { Router } from "express";
import { supervisorRefreshSession, supervisorLogout, supervisorMe } from "./auth.service";
import { authenticateSupervisor, requireActiveSupervisor } from "../../middlewares/supervisorAuth";
import { asyncHandler } from "../../middlewares/errorHandler";
import { authLimiter } from "../../middlewares/rateLimiter";

const router = Router();

router.post("/refresh", asyncHandler(supervisorRefreshSession));
router.post("/logout", authLimiter, asyncHandler(supervisorLogout));
router.get("/me", authenticateSupervisor, requireActiveSupervisor, asyncHandler(supervisorMe));

export { router as supervisorAuthRouter };