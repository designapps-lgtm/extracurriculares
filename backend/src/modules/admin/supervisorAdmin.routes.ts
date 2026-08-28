import { Router } from "express";
import { getSupervisors, getSupervisorById, createSupervisor, updateSupervisor, deleteSupervisor } from "./supervisorAdmin.controller";
import { asyncHandler } from "../../middlewares/errorHandler";

const router = Router();

router.get("/", asyncHandler(getSupervisors));
router.post("/", asyncHandler(createSupervisor));
router.get("/:id", asyncHandler(getSupervisorById));
router.patch("/:id", asyncHandler(updateSupervisor));
router.delete("/:id", asyncHandler(deleteSupervisor));

export { router as adminSupervisorRouter };