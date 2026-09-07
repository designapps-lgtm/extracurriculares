import { Router } from "express";
import { asyncHandler } from "../../middlewares/errorHandler";
import { cambiarEstadoReporte, crearReporte, listarReportes } from "./report.controller";

// Router para creación: se monta bajo el prefijo de cada rol (docente,
// supervisor, secretaría y admin) con la autenticación de su rol.
export const reportRouter = Router();
reportRouter.post("/", asyncHandler(crearReporte));

// Router de administración: además de crear (un admin también reporta),
// lista reportes y cambia su estado.
export const adminReportRouter = Router();
adminReportRouter.post("/", asyncHandler(crearReporte));
adminReportRouter.get("/", asyncHandler(listarReportes));
adminReportRouter.patch("/:id", asyncHandler(cambiarEstadoReporte));