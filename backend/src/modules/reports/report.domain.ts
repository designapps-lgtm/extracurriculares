import crypto from "crypto";
import { nowIso } from "../../utils/colombiaTime";
import { isoToMysql, mysqlToIsoUtc } from "../../db/dates";
import { execute, query, queryOne } from "../../db/mysql";

export type ReportCategoria = "problema" | "sugerencia" | "otro";
export type ReportEstado = "nuevo" | "en_progreso" | "resuelto";

export const REPORT_CATEGORIAS: ReportCategoria[] = ["problema", "sugerencia", "otro"];
export const REPORT_ESTADOS: ReportEstado[] = ["nuevo", "en_progreso", "resuelto"];

export interface AppReport {
  id: string;
  categoria: ReportCategoria;
  descripcion: string;
  pagina: string;
  usuarioId: string;
  tipoUsuario: string;
  correo: string;
  estado: ReportEstado;
  createdAt: string | null;
  updatedAt: string | null;
}

interface ReportRow {
  id: string;
  categoria: string;
  descripcion: string;
  pagina: string | null;
  usuario_id: string | null;
  tipo_usuario: string | null;
  correo: string | null;
  estado: string;
  created_at: string | null;
  updated_at: string | null;
}

function mapReport(row: ReportRow | null): AppReport | null {
  if (!row || !row.id) return null;
  const categoria = row.categoria;
  const descripcion = row.descripcion;
  if (!descripcion) return null;
  const estado = row.estado || "nuevo";
  return {
    id: row.id,
    categoria: REPORT_CATEGORIAS.includes(categoria as ReportCategoria) ? (categoria as ReportCategoria) : "otro",
    descripcion,
    pagina: row.pagina ?? "",
    usuarioId: row.usuario_id ?? "",
    tipoUsuario: row.tipo_usuario ?? "",
    correo: row.correo ?? "",
    estado: REPORT_ESTADOS.includes(estado as ReportEstado) ? (estado as ReportEstado) : "nuevo",
    createdAt: row.created_at ? mysqlToIsoUtc(row.created_at) : null,
    updatedAt: row.updated_at ? mysqlToIsoUtc(row.updated_at) : null,
  };
}

export async function listReports(options: { fresh?: boolean; estado?: ReportEstado } = {}): Promise<AppReport[]> {
  const params: string[] = [];
  let where = "WHERE 1=1";
  if (options.estado) {
    where += " AND estado = ?";
    params.push(options.estado);
  }
  const rows = await query<ReportRow[]>(
    `SELECT * FROM reports ${where} ORDER BY created_at DESC`,
    params,
  );
  const reports = rows
    .map(mapReport)
    .filter((report): report is AppReport => report !== null);
  return options.estado ? reports.filter((report) => report.estado === options.estado) : reports;
}

export async function createReport(input: Omit<AppReport, "id" | "estado" | "createdAt" | "updatedAt">): Promise<AppReport> {
  const id = crypto.randomUUID();
  const now = nowIso();
  await execute(
    `INSERT INTO reports (id, categoria, descripcion, pagina, usuario_id, tipo_usuario, correo, estado, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'nuevo', ?, ?)`,
    [id, input.categoria, input.descripcion, input.pagina || null, input.usuarioId || null, input.tipoUsuario || null, input.correo || null, isoToMysql(now), isoToMysql(now)],
  );
  const created = mapReport(await queryOne<ReportRow>("SELECT * FROM reports WHERE id = ?", [id]));
  if (!created) throw new Error("MySQL no devolvió el reporte creado");
  return created;
}

export async function updateReportEstado(id: string, estado: ReportEstado): Promise<AppReport> {
  const current = mapReport(await queryOne<ReportRow>("SELECT * FROM reports WHERE id = ?", [id]));
  if (!current) throw Object.assign(new Error("Reporte no encontrado"), { clientCode: "NOT_FOUND" });
  await execute("UPDATE reports SET estado = ?, updated_at = ? WHERE id = ?", [estado, isoToMysql(nowIso()), id]);
  const updated = mapReport(await queryOne<ReportRow>("SELECT * FROM reports WHERE id = ?", [id]));
  if (!updated) throw new Error("MySQL no devolvió el reporte actualizado");
  return updated;
}