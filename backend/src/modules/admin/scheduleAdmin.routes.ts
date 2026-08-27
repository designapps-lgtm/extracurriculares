import { Router } from "express";
import { listSchedules, getScheduleById, createSchedule } from "./scheduleAdmin.controller";
import { asyncHandler } from "../../middlewares/errorHandler";

const router = Router();

router.post("/", asyncHandler(createSchedule));
router.get("/", asyncHandler(listSchedules));
router.get("/:id", asyncHandler(getScheduleById));

export { router as adminScheduleRouter };