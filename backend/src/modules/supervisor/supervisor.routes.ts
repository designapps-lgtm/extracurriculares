import { Router } from "express";
import { authenticateSupervisor, requireActiveSupervisor } from "../../middlewares/supervisorAuth";
import { asyncHandler } from "../../middlewares/errorHandler";
import {
  getSupervisorSessions,
  getSupervisorSessionAttendance,
  getSupervisorFilters,
  exportSupervisorAttendance,
} from "./supervisor.service";

const router = Router();

router.use(authenticateSupervisor, requireActiveSupervisor);

router.get("/filters", asyncHandler(getSupervisorFilters));
router.get("/sessions/export", asyncHandler(exportSupervisorAttendance));
router.get("/sessions", asyncHandler(getSupervisorSessions));
router.get("/sessions/:sessionId", asyncHandler(getSupervisorSessionAttendance));

export { router as supervisorDashboardRouter };