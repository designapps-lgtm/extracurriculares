import { Router } from "express";
import { secretaryRefreshSession, secretaryLogout, secretaryMe } from "./auth.service";
import { authenticateSecretary, requireActiveSecretary } from "../../middlewares/secretaryAuth";
import { asyncHandler } from "../../middlewares/errorHandler";
import { authLimiter } from "../../middlewares/rateLimiter";

const router = Router();

router.post("/refresh", asyncHandler(secretaryRefreshSession));
router.post("/logout", authLimiter, asyncHandler(secretaryLogout));
router.get("/me", authenticateSecretary, requireActiveSecretary, asyncHandler(secretaryMe));

export { router as secretaryAuthRouter };
