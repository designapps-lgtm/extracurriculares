import { Router } from "express";
import { authenticateSecretary, requireActiveSecretary } from "../../middlewares/secretaryAuth";
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
  listSupervisorTransfers,
  getSupervisorClasses,
} from "../supervisor/supervisor.service";
import { getSecretaryClassStudents } from "./secretary.service";
import { getNovedadesBatch } from "../novedades/novedades.controller";

const router = Router();

router.use(authenticateSecretary, requireActiveSecretary);

// La secretaria solo visualiza: no inicia sesiones, no toma asistencia,
// no crea ni elimina stays/traslados.

// Vista "Llamar lista" de solo lectura: las clases del día con sus grados.
router.get("/classes", asyncHandler(getSupervisorClasses));
router.get("/classes/:asignacionId/:horarioId/students", asyncHandler(getSecretaryClassStudents));

// Asistencias (visualización)
router.get("/sessions/export", asyncHandler(exportSupervisorAttendance));
router.get("/sessions/:sessionId/export", asyncHandler(exportSupervisorSessionAttendance));
router.get("/sessions", asyncHandler(getSupervisorSessions));
router.get("/sessions/:sessionId", asyncHandler(getSupervisorSessionAttendance));

// Filtros para el dashboard
router.get("/filters", asyncHandler(getSupervisorFilters));

// Novedades para la secretaria (mismo batch de los profesores)
router.get("/novedades/batch", asyncHandler(getNovedadesBatch));

// Horarios
router.get("/schedules", asyncHandler(getSupervisorTeacherSchedules));
router.get("/schedules/:asignacionId/:horarioId", asyncHandler(getSupervisorScheduleHistory));
router.get("/schedules/:asignacionId", asyncHandler(getSupervisorAssignmentHistory));

// Niños que se quedan (solo lectura)
router.get("/stays/search", asyncHandler(searchSupervisorStudents));
router.get("/stays", asyncHandler(getSupervisorStays));

// Traslados (solo lectura)
router.get("/transfers", asyncHandler(listSupervisorTransfers));

export { router as secretaryDashboardRouter };
