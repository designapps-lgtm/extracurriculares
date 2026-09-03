import { Router } from "express";
import { authenticateSupervisor, requireActiveSupervisor } from "../../middlewares/supervisorAuth";
import { asyncHandler } from "../../middlewares/errorHandler";
import {
  getSupervisorSessions,
  getSupervisorSessionAttendance,
  getSupervisorFilters,
  exportSupervisorAttendance,
  exportSupervisorSessionAttendance,
  getSupervisorTeacherSchedules,
  getSupervisorScheduleHistory,
  getSupervisorAssignmentHistory,
  searchSupervisorStudents,
  getSupervisorStays,
  createSupervisorStay,
  deleteSupervisorStay,
  getSupervisorClasses,
  supervisorStartSession,
  getSupervisorAttendanceList,
  supervisorSaveAttendance,
} from "./supervisor.service";
import { getNovedadesBatch, getNovedadesDiarias } from "../novedades/novedades.controller";

const router = Router();

router.use(authenticateSupervisor, requireActiveSupervisor);

router.get("/classes", asyncHandler(getSupervisorClasses));

// Toma de asistencia del supervisor
router.post("/sessions/start", asyncHandler(supervisorStartSession));
router.get("/sessions/:sessionId/attendance", asyncHandler(getSupervisorAttendanceList));
router.post("/sessions/:sessionId/attendance", asyncHandler(supervisorSaveAttendance));

// Novedades para el supervisor (mismo batch de los profesores)
router.get("/novedades/batch", asyncHandler(getNovedadesBatch));
router.get("/novedades/diarias", asyncHandler(getNovedadesDiarias));

router.get("/stays/search", asyncHandler(searchSupervisorStudents));
router.get("/stays", asyncHandler(getSupervisorStays));
router.post("/stays", asyncHandler(createSupervisorStay));
router.delete("/stays/:stayId", asyncHandler(deleteSupervisorStay));

router.get("/schedules", asyncHandler(getSupervisorTeacherSchedules));
router.get("/schedules/:asignacionId/:horarioId", asyncHandler(getSupervisorScheduleHistory));
router.get("/schedules/:asignacionId", asyncHandler(getSupervisorAssignmentHistory));
router.get("/filters", asyncHandler(getSupervisorFilters));
router.get("/sessions/export", asyncHandler(exportSupervisorAttendance));
router.get("/sessions/:sessionId/export", asyncHandler(exportSupervisorSessionAttendance));
router.get("/sessions", asyncHandler(getSupervisorSessions));
router.get("/sessions/:sessionId", asyncHandler(getSupervisorSessionAttendance));

export { router as supervisorDashboardRouter };
