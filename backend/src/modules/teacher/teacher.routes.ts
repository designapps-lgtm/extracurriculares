import { Router } from "express";
import { authenticateTeacher, requireActiveTeacher } from "../../middlewares/teacherAuth";
import { asyncHandler } from "../../middlewares/errorHandler";
import { getTeacherClasses, getTeacherAllAssignments, startSession, getAttendanceList, saveAttendance } from "./teacher.service";
import { getNovedadesByCodigo, getNovedadesBatch, getNovedadesCatalogo } from "../novedades/novedades.controller";

const router = Router();

router.use(authenticateTeacher, requireActiveTeacher);

router.get("/classes", asyncHandler(getTeacherClasses));
router.get("/assignments", asyncHandler(getTeacherAllAssignments));
router.post("/sessions/start", asyncHandler(startSession));
router.get("/sessions/:sessionId/attendance", asyncHandler(getAttendanceList));
router.post("/sessions/:sessionId/attendance", asyncHandler(saveAttendance));
router.get("/novedades/catalogo", asyncHandler(getNovedadesCatalogo));
router.get("/novedades/batch", asyncHandler(getNovedadesBatch));
router.get("/novedades/:codigoEstudiante", asyncHandler(getNovedadesByCodigo));

export { router as teacherDashboardRouter };
