import { Router } from "express";
import { asyncHandler } from "../../middlewares/errorHandler";
import { getNovedadesDiarias } from "../novedades/novedades.controller";

const router = Router();

router.get("/diarias", asyncHandler(getNovedadesDiarias));

export { router as adminNovedadesRouter };
