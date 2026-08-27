import { Router } from "express";
import { getStats } from "./dashboardAdmin.controller";
import { asyncHandler } from "../../middlewares/errorHandler";

const router = Router();

router.get("/stats", asyncHandler(getStats));

export { router as adminDashboardRouter };