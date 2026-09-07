import type { Request, Response } from "express";
import { AppError } from "../../middlewares/errorHandler";
import {
  REPORT_CATEGORIAS,
  REPORT_ESTADOS,
  createReport,
  listReports,
  updateReportEstado,
  type ReportCategoria,
  type ReportEstado,
} from "./report.domain";

interface Caller {
  usuarioId: string;
  tipoUsuario: string;
  correo: string;
}

function callerFrom(req: Request): Caller | null {
  if (req.admin) return { usuarioId: req.admin.adminId, tipoUsuario: "admin", correo: req.admin.email };
  if (req.supervisor) return { usuarioId: req.supervisor.supervisorId, tipoUsuario: "supervisor", correo: req.supervisor.email };
  if (req.secretary) return { usuarioId: req.secretary.secretaryId, tipoUsuario: "secretary", correo: req.secretary.email };
  if (req.teacher) return { usuarioId: req.teacher.teacherId, tipoUsuario: "teacher", correo: req.teacher.email };
  return null;
}

function parseCategoria(value: unknown): ReportCategoria {
  const categoria = typeof value === "string" ? value : "";
  if (!REPORT_CATEGORIAS.includes(categoria as ReportCategoria)) {
    throw new AppError(400, "VALIDATION_ERROR", "Categoría inválida");
  }
  return categoria as ReportCategoria;
}

function parseDescripcion(value: unknown): string {
  if (typeof value !== "string" || value.trim().length < 5) {
    throw new AppError(400, "VALIDATION_ERROR", "Describí el problema (mínimo 5 caracteres)");
  }
  return value.trim().slice(0, 2000);
}

export async function crearReporte(req: Request, res: Response): Promise<void> {
  const caller = callerFrom(req);
  if (!caller) throw new AppError(401, "UNAUTHORIZED", "No autenticado");

  const body = req.body ?? {};
  const categoria = parseCategoria(body.categoria);
  const descripcion = parseDescripcion(body.descripcion);
  const pagina = typeof body.pagina === "string" ? body.pagina.trim().slice(0, 500) : "";

  const reporte = await createReport({
    categoria,
    descripcion,
    pagina,
    usuarioId: caller.usuarioId,
    tipoUsuario: caller.tipoUsuario,
    correo: caller.correo,
  });

  res.json({ success: true, data: reporte });
}

export async function listarReportes(req: Request, res: Response): Promise<void> {
  if (!req.admin) throw new AppError(403, "FORBIDDEN", "Acceso denegado");

  const estado = typeof req.query.estado === "string" && REPORT_ESTADOS.includes(req.query.estado as ReportEstado)
    ? (req.query.estado as ReportEstado)
    : undefined;

  const result = await listReports({ estado });
  res.json({ success: true, data: result });
}

export async function cambiarEstadoReporte(req: Request, res: Response): Promise<void> {
  if (!req.admin) throw new AppError(403, "FORBIDDEN", "Acceso denegado");

  const id = String(req.params.id ?? "");
  if (!id) throw new AppError(400, "VALIDATION_ERROR", "ID de reporte requerido");

  const estado = typeof req.body?.estado === "string" && REPORT_ESTADOS.includes(req.body.estado as ReportEstado)
    ? (req.body.estado as ReportEstado)
    : null;
  if (!estado) throw new AppError(400, "VALIDATION_ERROR", "Estado inválido");

  const result = await updateReportEstado(id, estado);
  res.json({ success: true, data: result });
}