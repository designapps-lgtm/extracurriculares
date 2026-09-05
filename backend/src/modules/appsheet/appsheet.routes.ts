import { Router } from "express";
import { asyncHandler } from "../../middlewares/errorHandler";
import { syncNovedades, syncStudents } from "./appsheet.controller";

const router = Router();

// Dispara el sync de estudiantes desde la tabla "Demograficos" de AppSheet.
// Puede llamarse desde una automatización de AppSheet cuando cambian los datos.
router.post("/students/sync", asyncHandler(syncStudents));

// Sincronización inmediata de la tabla AppSheet "Novedades_Diarias".
// Una automatización de AppSheet puede invocarla al agregar o actualizar filas.
router.post("/novedades/sync", asyncHandler(syncNovedades));

export { router as appSheetSyncRouter };
