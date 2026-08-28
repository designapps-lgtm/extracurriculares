import { Router } from "express";
import { supervisorLogin, supervisorRefreshSession, supervisorLogout, supervisorMe } from "./auth.service";
import { authenticateSupervisor, requireActiveSupervisor } from "../../middlewares/supervisorAuth";
import { asyncHandler } from "../../middlewares/errorHandler";

const router = Router();

router.post("/login", asyncHandler(supervisorLogin));
router.post("/refresh", asyncHandler(supervisorRefreshSession));
router.post("/logout", asyncHandler(supervisorLogout));
router.get("/me", authenticateSupervisor, requireActiveSupervisor, asyncHandler(supervisorMe));

export { router as supervisorAuthRouter };