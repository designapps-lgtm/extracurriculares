import { Router } from "express";
import { login, refreshSession, logout, me, bootstrap } from "./auth.service";
import { authenticate, requireAdmin } from "../../middlewares/auth";
import { asyncHandler } from "../../middlewares/errorHandler";

const router = Router();

router.post("/login", asyncHandler(login));
router.post("/refresh", asyncHandler(refreshSession));
router.post("/logout", asyncHandler(logout));
router.get("/me", authenticate, requireAdmin, asyncHandler(me));
router.post("/bootstrap", asyncHandler(bootstrap));

export { router as adminAuthRouter };