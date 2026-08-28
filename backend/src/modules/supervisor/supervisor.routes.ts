import { Router } from "express";
import { authenticateSupervisor, requireActiveSupervisor } from "../../middlewares/supervisorAuth";
import { asyncHandler } from "../../middlewares/errorHandler";
import { getSupervisorSessions, getSupervisorSessionAttendance } from "./supervisor.service";

const router = Router();

router.use(authenticateSupervisor, requireActiveSupervisor);

router.get("/sessions", asyncHandler(getSupervisorSessions));
router.get("/sessions/:sessionId", asyncHandler(getSupervisorSessionAttendance));

export { router as supervisorDashboardRouter };