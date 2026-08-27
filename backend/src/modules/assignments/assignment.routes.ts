import { Router } from "express";
import * as assignmentController from "./assignment.controller";

const router = Router();

router.get("/", assignmentController.getAll);
router.get("/:id", assignmentController.getById);

export { router as assignmentRouter };
