import { Router } from "express";
import { asyncHandler } from "../../middlewares/errorHandler";
import { syncStudents, syncTable } from "./appsheet.controller";

const router = Router();

// Dispara el sync de estudiantes desde la tabla "Demograficos" de AppSheet.
// Puede llamarse desde una automatización de AppSheet cuando cambian los datos.
router.post("/students/sync", asyncHandler(syncStudents));

// Push de cambios de fila: AppSheet llama este endpoint (automatización
// "Call a webhook") con { table } y el backend refresca KV + memoria en caliente.
router.post("/tables/sync", asyncHandler(syncTable));

export { router as appSheetSyncRouter };
