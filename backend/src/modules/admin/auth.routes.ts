import { Router } from "express";
import { login, refreshSession, logout, me, bootstrap } from "./auth.controller";
import { authenticate, requireAdmin } from "../../middlewares/auth";
import { asyncHandler } from "../../middlewares/errorHandler";
import { authLimiter } from "../../middlewares/rateLimiter";

const router = Router();

router.post("/login", authLimiter, asyncHandler(login));
router.post("/refresh", asyncHandler(refreshSession));
router.post("/logout", authLimiter, asyncHandler(logout));
router.get("/me", authenticate, requireAdmin, asyncHandler(me));
router.post("/bootstrap", authLimiter, asyncHandler(bootstrap));

export { router as adminAuthRouter };