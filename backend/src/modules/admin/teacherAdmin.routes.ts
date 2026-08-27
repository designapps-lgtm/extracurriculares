import { Router } from "express";
import { getTeachers, getTeacherById, createTeacher, updateTeacher, deleteTeacher, resetTeacherPassword } from "./teacherAdmin.service";
import { asyncHandler } from "../../middlewares/errorHandler";

const router = Router();

router.get("/", asyncHandler(getTeachers));
router.post("/", asyncHandler(createTeacher));
router.get("/:id", asyncHandler(getTeacherById));
router.patch("/:id", asyncHandler(updateTeacher));
router.delete("/:id", asyncHandler(deleteTeacher));
router.patch("/:id/reset-password", asyncHandler(resetTeacherPassword));

export { router as adminTeacherRouter };
