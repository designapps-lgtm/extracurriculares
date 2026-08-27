import { Router } from "express";
import { getStudents, getStudentByCode, updateStudent } from "./studentAdmin.service";
import { asyncHandler } from "../../middlewares/errorHandler";

const router = Router();

router.get("/", asyncHandler(getStudents));
router.get("/:codigo", asyncHandler(getStudentByCode));
router.patch("/:codigo", asyncHandler(updateStudent));

export { router as adminStudentRouter };
