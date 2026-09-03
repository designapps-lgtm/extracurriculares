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
} from "../supervisor/supervisor.service";
import { getSecretaryClassStudents } from "../secretary/secretary.service";
import { getNovedadesBatch, getNovedadesDiarias } from "../novedades/novedades.controller";
import {
  adminStartSession,
  attendanceList,
  adminSaveAttendance,
} from "../attendance/attendance.service";

const router = Router();

// Operaciones de Asistencia Extracurriculares para Admin: mismas reglas de roster,
// pero bajo autenticación Admin y limitado a clases del día.
router.post("/sessions/start", asyncHandler(adminStartSession));
router.get("/sessions/:sessionId/attendance", asyncHandler(attendanceList));
router.post("/sessions/:sessionId/attendance", asyncHandler(adminSaveAttendance));

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

export { router as adminOperationsRouter };
