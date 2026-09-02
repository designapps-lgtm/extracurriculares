import { Router } from "express";
import { listDisciplines, getDisciplineGrades } from "./disciplineAdmin.controller";
import { asyncHandler } from "../../middlewares/errorHandler";

const router = Router();

router.get("/", asyncHandler(listDisciplines));
router.get("/:codigo/grades", asyncHandler(getDisciplineGrades));

export { router as adminDisciplineRouter };