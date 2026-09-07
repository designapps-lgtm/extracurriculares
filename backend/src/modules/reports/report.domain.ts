import crypto from "crypto";
import { nowIso } from "../../utils/colombiaTime";
import {
  APPSHEET_TABLES,
  addRows,
  editRows,
  getTableRows,
  nullableTextCell,
  textCell,
} from "../appsheet/appsheet.repository";
import type { AppSheetRow } from "../appsheet/appsheet.service";

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

function mapReport(row: AppSheetRow): AppReport | null {
  const id = textCell(row, "ReporteID");
  if (!id) return null;
  const categoria = textCell(row, "Categoria");
  const descripcion = textCell(row, "Descripcion");
  if (!descripcion) return null;
  const estado = textCell(row, "Estado") || "nuevo";
  return {
    id,
    categoria: REPORT_CATEGORIAS.includes(categoria as ReportCategoria) ? (categoria as ReportCategoria) : "otro",
    descripcion,
    pagina: textCell(row, "Pagina"),
    usuarioId: textCell(row, "UsuarioID"),
    tipoUsuario: textCell(row, "TipoUsuario"),
    correo: textCell(row, "Correo"),
    estado: REPORT_ESTADOS.includes(estado as ReportEstado) ? (estado as ReportEstado) : "nuevo",
    createdAt: nullableTextCell(row, "CreatedAt"),
    updatedAt: nullableTextCell(row, "UpdatedAt"),
  };
}

export async function listReports(options: { fresh?: boolean; estado?: ReportEstado } = {}): Promise<AppReport[]> {
  const rows = await getTableRows(APPSHEET_TABLES.reports, { fresh: options.fresh });
  return rows
    .map(mapReport)
    .filter((report): report is AppReport => report !== null)
    .filter((report) => !options.estado || report.estado === options.estado)
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

function reportWriteRow(input: Omit<AppReport, "id" | "estado" | "createdAt" | "updatedAt"> & { id: string; estado: ReportEstado }): AppSheetRow {
  return {
    ReporteID: input.id,
    Categoria: input.categoria,
    Descripcion: input.descripcion,
    Pagina: input.pagina,
    UsuarioID: input.usuarioId,
    TipoUsuario: input.tipoUsuario,
    Correo: input.correo,
    Estado: input.estado,
    CreatedAt: nowIso(),
    UpdatedAt: nowIso(),
  };
}

export async function createReport(input: Omit<AppReport, "id" | "estado" | "createdAt" | "updatedAt">): Promise<AppReport> {
  const id = crypto.randomUUID();
  await addRows(APPSHEET_TABLES.reports, [reportWriteRow({ ...input, id, estado: "nuevo" })]);
  const created = (await listReports({ fresh: true })).find((report) => report.id === id);
  if (!created) throw new Error("AppSheet no devolvió el reporte creado");
  return created;
}

export async function updateReportEstado(id: string, estado: ReportEstado): Promise<AppReport> {
  const current = (await listReports({ fresh: true })).find((report) => report.id === id);
  if (!current) throw Object.assign(new Error("Reporte no encontrado"), { clientCode: "NOT_FOUND" });
  const row: AppSheetRow = { ReporteID: current.id, Estado: estado, UpdatedAt: nowIso() };
  // En Edit AppSheet preserva las columnas omitidas tal cual están (patrón de userWriteRow).
  await editRows(APPSHEET_TABLES.reports, [row]);
  const updated = (await listReports({ fresh: true })).find((report) => report.id === id);
  if (!updated) throw new Error("AppSheet no devolvió el reporte actualizado");
  return updated;
}