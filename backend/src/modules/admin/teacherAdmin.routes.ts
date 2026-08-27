import { Router } from "express";
import { getTeachers, getTeacherById, createTeacher, updateTeacher, deleteTeacher } from "./teacherAdmin.controller";
import { asyncHandler } from "../../middlewares/errorHandler";

const router = Router();

router.get("/", asyncHandler(getTeachers));
router.post("/", asyncHandler(createTeacher));
router.get("/:id", asyncHandler(getTeacherById));
router.patch("/:id", asyncHandler(updateTeacher));
router.delete("/:id", asyncHandler(deleteTeacher));

export { router as adminTeacherRouter };
