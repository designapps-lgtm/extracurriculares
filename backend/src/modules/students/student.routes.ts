import { Router } from "express";
import * as studentController from "./student.controller";

const router = Router();

router.get("/", studentController.getAll);
router.get("/:codigo/profile", studentController.getProfile);
router.get("/:codigo", studentController.getByCode);

export { router as studentRouter };
