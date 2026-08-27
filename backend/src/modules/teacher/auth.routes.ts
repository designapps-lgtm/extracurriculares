import { Router } from "express";
import { teacherLogin, teacherRefreshSession, teacherLogout, teacherMe } from "./auth.service";
import { authenticateTeacher, requireActiveTeacher } from "../../middlewares/teacherAuth";
import { asyncHandler } from "../../middlewares/errorHandler";

const router = Router();

router.post("/login", asyncHandler(teacherLogin));
router.post("/refresh", asyncHandler(teacherRefreshSession));
router.post("/logout", asyncHandler(teacherLogout));
router.get("/me", authenticateTeacher, requireActiveTeacher, asyncHandler(teacherMe));

export { router as teacherAuthRouter };