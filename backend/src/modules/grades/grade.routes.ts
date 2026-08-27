import { Router } from "express";
import * as gradeController from "./grade.controller";

const router = Router();

router.get("/", gradeController.getAll);
router.get("/:id/students", gradeController.getStudents);
router.get("/:id/assignments", gradeController.getAssignments);
router.get("/:id", gradeController.getById);

export { router as gradeRouter };
