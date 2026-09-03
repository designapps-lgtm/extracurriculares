import { Router } from "express";
import { asyncHandler } from "../../middlewares/errorHandler";
import { syncNovedades, syncNovedadesFromApi, syncStudents } from "./appsheet.controller";

const router = Router();

// Dispara el sync de estudiantes desde la tabla "Demograficos" de AppSheet.
router.post("/students/sync", asyncHandler(syncStudents));

// Recibe una fila de novedad desde un Bot de AppSheet en tiempo casi real.
router.post("/novedades", asyncHandler(syncNovedades));

// Respaldo opcional: consulta la tabla de novedades mediante la API de AppSheet.
router.post("/novedades/sync", asyncHandler(syncNovedadesFromApi));

export { router as appSheetSyncRouter };
