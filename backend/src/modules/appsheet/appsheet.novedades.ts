import { config } from "../../config";
import { loadCoreData } from "../../db/views";
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
  const data = await loadCoreData();
  const result = new Map<string, LiveStudentInfo>();
  for (const student of data.students) {
    const schedules = data.enrollments
      .filter((row) => row.studentCode === student.code)
      .map((row) => ({ diaSemana: row.day, codigoDisciplina: row.disciplineCode }));
    result.set(student.code, {
      codigoEstudiante: student.code,
      nombre: student.firstName,
      apellido: student.lastName,
      grupo: student.group,
      grado: data.gradeById.get(student.gradeId)?.name ?? student.gradeName,
      fotoUrl: student.photoUrl,
      schedules,
      days: new Set(schedules.map((row) => row.diaSemana)),
    });
  }
  return result;
}

const NOVEDADES_CACHE_MS = 15_000;
type NovedadesCacheEntry = { expiresAt: number; promise: Promise<LiveNovedad[]> };
const novedadesCache = new Map<string, NovedadesCacheEntry>();

export function clearNovedadesCache(): void {
  novedadesCache.clear();
}

export async function getLiveNovedades(): Promise<LiveNovedad[]> {
  const table = config.appsheetNovedadesTable;
  const appId = config.appsheetNovedadesAppId;
  const accessKey = config.appsheetNovedadesAccessKey;
  if (!table || !appId || !accessKey) return [];

  const now = Date.now();
  const current = novedadesCache.get(table);
  if (current && current.expiresAt > now) return current.promise;

  const promise = findAppSheetRows(table, undefined, { appId, accessKey })
    .then((rows) =>
      parseNovedadesRows(rows as Record<string, unknown>[], `AppSheet:${table}`).map((row) => ({
        ...row,
        id: `${row.novedadId}:${row.codigoEstudiante}`,
        archivo: table,
      })),
    )
    .catch((error) => {
      novedadesCache.delete(table);
      throw error;
    });
  novedadesCache.set(table, { expiresAt: now + NOVEDADES_CACHE_MS, promise });
  return promise;
}

export async function getLiveNovedadesForStudents(codigos: string[]): Promise<LiveNovedad[]> {
  const wanted = new Set(codigos);
  return (await getLiveNovedades()).filter((row) => wanted.has(row.codigoEstudiante));
}
