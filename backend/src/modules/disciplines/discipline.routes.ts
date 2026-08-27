import { Router } from "express";
import * as disciplineController from "./discipline.controller";

const router = Router();

router.get("/", disciplineController.getAll);
router.get("/:codigo/students", disciplineController.getStudents);
router.get("/:codigo/teachers", disciplineController.getTeachers);
router.get("/:codigo", disciplineController.getByCodigo);

export { router as disciplineRouter };
