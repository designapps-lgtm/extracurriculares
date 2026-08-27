import { Router } from "express";
import { listGrades } from "./gradeAdmin.controller";
import { asyncHandler } from "../../middlewares/errorHandler";

const router = Router();

router.get("/", asyncHandler(listGrades));

export { router as adminGradeRouter };