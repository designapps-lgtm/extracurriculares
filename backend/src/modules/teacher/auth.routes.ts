import { Router } from "express";
import { teacherGoogleLogin, teacherRefreshSession, teacherLogout, teacherMe } from "./auth.service";
import { authenticateTeacher, requireActiveTeacher } from "../../middlewares/teacherAuth";
import { asyncHandler } from "../../middlewares/errorHandler";
import { authLimiter } from "../../middlewares/rateLimiter";

const router = Router();

router.post("/google", authLimiter, asyncHandler(teacherGoogleLogin));
router.post("/refresh", asyncHandler(teacherRefreshSession));
router.post("/logout", authLimiter, asyncHandler(teacherLogout));
router.get("/me", authenticateTeacher, requireActiveTeacher, asyncHandler(teacherMe));

export { router as teacherAuthRouter };