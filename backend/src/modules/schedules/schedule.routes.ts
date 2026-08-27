import { Router } from "express";
import * as scheduleController from "./schedule.controller";

const router = Router();

router.get("/", scheduleController.getAll);
router.get("/:id", scheduleController.getById);

export { router as scheduleRouter };
