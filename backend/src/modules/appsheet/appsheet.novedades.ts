import { config } from "../../config";
import { mapAppSheetStudents } from "./appsheet.students";
import { findAppSheetRows } from "./appsheet.service";
import { parseNovedadesRows, type ParsedNovedadRow } from "../novedades/novedades.parser";

export interface LiveStudentInfo {
  codigoEstudiante: string;
  nombre: string;
  apellido: string;
  grupo: string | null;
  grado: string;
  fotoUrl: string | null;
  schedules: Array<{ diaSemana: string; codigoDisciplina: string }>;
  days: Set<string>;
}

export interface LiveNovedad extends ParsedNovedadRow {
  id: string;
  archivo: string;
}

export async function getLiveStudentIndex(): Promise<Map<string, LiveStudentInfo>> {
  const rows = await findAppSheetRows(config.appsheetDemograficosTable);
  const students = mapAppSheetStudents(rows);
  const byCode = new Map<string, LiveStudentInfo>();

  for (const student of students) {
    byCode.set(student.codigoEstudiante, {
      codigoEstudiante: student.codigoEstudiante,
      nombre: student.nombre,
      apellido: student.apellido,
      grupo: student.grupo,
      grado: student.gradeNombre,
      fotoUrl: null,
      schedules: student.schedules,
      days: new Set(student.schedules.map((schedule) => schedule.diaSemana)),
    });
  }

  return byCode;
}

export async function getLiveNovedades(): Promise<LiveNovedad[]> {
  const table = config.appsheetNovedadesTable;
  const rows = await findAppSheetRows(table);
  return parseNovedadesRows(rows as Record<string, unknown>[], `AppSheet:${table}`)
    .map((row) => ({
      ...row,
      id: `${row.novedadId}:${row.codigoEstudiante}`,
      archivo: table,
    }));
}

export async function getLiveNovedadesForStudents(codigos: string[]): Promise<LiveNovedad[]> {
  const wanted = new Set(codigos);
  return (await getLiveNovedades()).filter((novedad) => wanted.has(novedad.codigoEstudiante));
}
