import { Router } from "express";
import { asyncHandler } from "../../middlewares/errorHandler";
import { syncStudents } from "./appsheet.controller";

const router = Router();

// Dispara el sync de estudiantes desde la tabla "Demograficos" de AppSheet.
// Puede llamarse desde una automatización de AppSheet cuando cambian los datos.
router.post("/students/sync", asyncHandler(syncStudents));

export { router as appSheetSyncRouter };
