import { Router } from "express";
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
  getSupervisorClasses,
  listSupervisorTransfers,
} from "../supervisor/supervisor.service";
import { getSecretaryClassStudents } from "../secretary/secretary.service";
import { getNovedadesBatch, getNovedadesDiarias } from "../novedades/novedades.controller";

const router = Router();

// Operación en modo consulta para el panel administrador.
router.get("/classes", asyncHandler(getSupervisorClasses));
router.get("/classes/:asignacionId/:horarioId/students", asyncHandler(getSecretaryClassStudents));
router.get("/sessions/export", asyncHandler(exportSupervisorAttendance));
router.get("/sessions/:sessionId/export", asyncHandler(exportSupervisorSessionAttendance));
router.get("/sessions", asyncHandler(getSupervisorSessions));
router.get("/sessions/:sessionId", asyncHandler(getSupervisorSessionAttendance));
router.get("/novedades/batch", asyncHandler(getNovedadesBatch));
router.get("/novedades/diarias", asyncHandler(getNovedadesDiarias));
router.get("/schedules", asyncHandler(getSupervisorTeacherSchedules));
router.get("/schedules/:asignacionId/:horarioId", asyncHandler(getSupervisorScheduleHistory));
router.get("/schedules/:asignacionId", asyncHandler(getSupervisorAssignmentHistory));
router.get("/filters", asyncHandler(getSupervisorFilters));
router.get("/stays/search", asyncHandler(searchSupervisorStudents));
router.get("/stays", asyncHandler(getSupervisorStays));
router.get("/transfers", asyncHandler(listSupervisorTransfers));

export { router as adminOperationsRouter };
