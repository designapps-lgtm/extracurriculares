import { Router } from "express";
import { googleLogin, logout, me } from "./unifiedAuth";
import { asyncHandler } from "../../middlewares/errorHandler";
import { authLimiter } from "../../middlewares/rateLimiter";

const router = Router();

router.post("/google", authLimiter, asyncHandler(googleLogin));
router.post("/logout", authLimiter, asyncHandler(logout));
router.get("/me", asyncHandler(me));

export { router as unifiedAuthRouter };
