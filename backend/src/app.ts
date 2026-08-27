import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { config } from "./config";
import { errorHandler, notFound } from "./middlewares/errorHandler";
import { requestLogger } from "./middlewares/requestLogger";
import { authenticate, requireAdmin } from "./middlewares/auth";
import { apiLimiter, authLimiter } from "./middlewares/rateLimiter";
import { healthRouter } from "./modules/health/healthRouter";
import { studentRouter } from "./modules/students/student.routes";
import { disciplineRouter } from "./modules/disciplines/discipline.routes";
import { teacherRouter } from "./modules/teachers/teacher.routes";
import { gradeRouter } from "./modules/grades/grade.routes";
import { assignmentRouter } from "./modules/assignments/assignment.routes";
import { scheduleRouter } from "./modules/schedules/schedule.routes";

// Admin routes
import { adminAuthRouter } from "./modules/admin/auth.routes";
import { adminStudentRouter } from "./modules/admin/studentAdmin.routes";
import { adminTeacherRouter } from "./modules/admin/teacherAdmin.routes";
import { adminAssignmentRouter } from "./modules/admin/assignmentAdmin.routes";
import { adminDisciplineRouter } from "./modules/admin/disciplineAdmin.routes";
import { adminScheduleRouter } from "./modules/admin/scheduleAdmin.routes";
import { adminGradeRouter } from "./modules/admin/gradeAdmin.routes";
import { adminUserRouter } from "./modules/admin/adminUser.routes";
import { adminDashboardRouter } from "./modules/admin/dashboardAdmin.routes";

// Teacher routes
import { teacherAuthRouter } from "./modules/teacher/auth.routes";
import { teacherDashboardRouter } from "./modules/teacher/teacher.routes";
import { authenticateTeacher, requireActiveTeacher } from "./middlewares/teacherAuth";

const app = express();

// Detrás de un reverse proxy (Render) el IP real del cliente viene en
// X-Forwarded-For. Sin "trust proxy", req.ip es siempre el proxy → el rate
// limiter cuenta a todos los usuarios como una sola IP y bloquea la app entera.
if (config.nodeEnv === "production") {
  app.set("trust proxy", 1);
}

// Global middleware
app.use(helmet());
app.disable("x-powered-by");
// CORS: permite el frontend de producción (FRONTEND_URL) y cualquier
// preview de Vercel (*.vercel.app) sin barra final, para que los deploy
// preview no rompan el login entre commits.
function corsOrigin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
  const allowed = [config.frontendUrl, "http://localhost:5173"];
  const isVercelPreview = typeof origin === "string" && /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin);
  const isAllowed = !origin || allowed.some((a) => a.replace(/\/$/, "") === origin.replace(/\/$/, "") ) || isVercelPreview;
  callback(null, isAllowed);
}

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(requestLogger);

// Public routes (apiLimiter solo en endpoints públicos sin autenticación)
app.use("/api", healthRouter);
app.use("/api/students", apiLimiter, studentRouter);
app.use("/api/disciplines", apiLimiter, disciplineRouter);
app.use("/api/teachers", apiLimiter, teacherRouter);
app.use("/api/grades", apiLimiter, gradeRouter);
app.use("/api/assignments", apiLimiter, assignmentRouter);
app.use("/api/schedules", apiLimiter, scheduleRouter);

// Admin auth (login/logout don't need auth)
app.use("/api/admin/auth", authLimiter, adminAuthRouter);

// Protected admin routes   
app.use("/api/admin/dashboard", authenticate, requireAdmin, adminDashboardRouter);
app.use("/api/admin/students", authenticate, requireAdmin, adminStudentRouter);
app.use("/api/admin/teachers", authenticate, requireAdmin, adminTeacherRouter);
app.use("/api/admin/assignments", authenticate, requireAdmin, adminAssignmentRouter);
app.use("/api/admin/disciplines", authenticate, requireAdmin, adminDisciplineRouter);
app.use("/api/admin/schedules", authenticate, requireAdmin, adminScheduleRouter);
app.use("/api/admin/grades", authenticate, requireAdmin, adminGradeRouter);
app.use("/api/admin/admins", authenticate, requireAdmin, adminUserRouter);

// Teacher auth (login/logout don't need auth)
app.use("/api/teacher/auth", authLimiter, teacherAuthRouter);

// Protected teacher routes
app.use("/api/teacher", authenticateTeacher, requireActiveTeacher, teacherDashboardRouter);

// 404 + error handler
app.use(notFound);
app.use(errorHandler);

export default app;
