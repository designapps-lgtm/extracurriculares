import { Router } from "express";
import { listDisciplines } from "./disciplineAdmin.controller";
import { asyncHandler } from "../../middlewares/errorHandler";

const router = Router();

router.get("/", asyncHandler(listDisciplines));

export { router as adminDisciplineRouter };