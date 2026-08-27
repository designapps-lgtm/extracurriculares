import { Router } from "express";
import * as teacherController from "./teacher.controller";

const router = Router();

router.get("/", teacherController.getAll);
router.get("/:id/assignments", teacherController.getAssignments);
router.get("/:id", teacherController.getById);

export { router as teacherRouter };
