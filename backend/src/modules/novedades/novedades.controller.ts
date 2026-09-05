import { Request, Response } from "express";
import {
  getLiveNovedades,
  getLiveNovedadesForStudents,
  getLiveStudentIndex,
  type LiveNovedad,
  type LiveStudentInfo,
} from "../appsheet/appsheet.novedades";
import { dayBounds, isOnDay, novedadDate, novedadDayName } from "./novedades.dates";

function matchesExtracurricularDay(n: LiveNovedad, studentIndex: Map<string, LiveStudentInfo>): boolean {
  const student = studentIndex.get(n.codigoEstudiante);
  if (!student || student.days.size === 0) return false;
  return student.days.has(novedadDayName(n));
}

function isRelevantNovedad(n: LiveNovedad): boolean {
  const text = [
    n.descripcion,
    n.seAusentaCon,
    n.seAusentaConOtro,
    n.seAusentaConTipo,
    n.tipoNovedad,
    n.flujoNovedad,
  ]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();

  return Boolean(n.seAusentaCon || n.seAusentaConOtro || n.seAusentaConTipo) ||
    /SALIDA|AUSEN|CAMBIO|DEPORTE/.test(text);
}

function serialize(n: LiveNovedad) {
  return {
    id: n.id,
    novedadId: n.novedadId,
    codigoEstudiante: n.codigoEstudiante,
    archivo: n.archivo,
    descripcion: n.descripcion,
    seAusentaCon: n.seAusentaCon,
    seAusentaConOtro: n.seAusentaConOtro,
    seAusentaConTipo: n.seAusentaConTipo,
    tipoNovedad: n.tipoNovedad,
    flujoNovedad: n.flujoNovedad,
    grados: n.grados,
    nombresEstudiantes: n.nombresEstudiantes,
    fotoUrls: n.fotoUrls,
    fechaHora: n.fechaHora,
    scanCodes: n.scanCodes,
    fechaCreacion: n.fechaCreacion,
    registradoPor: n.registradoPor,
    procesado: n.procesado,
    regresaAlColegio: n.regresaAlColegio,
    horaEstimadaRegreso: n.horaEstimadaRegreso,
    fechaNovedad: n.fechaNovedad,
  };
}

function sortNewestFirst(a: LiveNovedad, b: LiveNovedad): number {
  return (novedadDate(b)?.getTime() || 0) - (novedadDate(a)?.getTime() || 0);
}

function fallbackStudent(novedad: LiveNovedad): LiveStudentInfo {
  const names = novedad.nombresEstudiantes.trim().split(/\s+/).filter(Boolean);
  return {
    codigoEstudiante: novedad.codigoEstudiante,
    nombre: names[0] || "Estudiante",
    apellido: names.slice(1).join(" "),
    grupo: null,
    grado: novedad.grados || "",
    fotoUrl: null,
    schedules: [],
    days: new Set(),
  };
}

export async function getNovedadesByCodigo(req: Request, res: Response): Promise<void> {
  const codigoEstudiante = String(req.params.codigoEstudiante || "");
  const fechaParam = String(req.query.fecha || "").trim();
  const bounds = dayBounds(fechaParam || new Date().toISOString());
  if (!bounds) {
    res.status(400).json({ success: false, error: { code: "INVALID_DATE", message: "La fecha no es valida" } });
    return;
  }

  const [todos, studentIndex] = await Promise.all([
    getLiveNovedadesForStudents([codigoEstudiante]),
    getLiveStudentIndex(),
  ]);

  const relevantes = todos
    .filter((n) => matchesExtracurricularDay(n, studentIndex))
    .filter((n) => isOnDay(n, bounds))
    .filter(isRelevantNovedad)
    .sort(sortNewestFirst);

  res.json({ success: true, data: relevantes.map(serialize) });
}

export async function getNovedadesBatch(req: Request, res: Response): Promise<void> {
  const raw = String(req.query.codigos || "");
  const fechaParam = String(req.query.fecha || "").trim();
  const codigos = raw.split(",").map((c) => c.trim()).filter(Boolean);
  if (codigos.length === 0) {
    res.json({ success: true, data: [] });
    return;
  }

  const bounds = dayBounds(fechaParam || new Date().toISOString());
  if (!bounds) {
    res.status(400).json({ success: false, error: { code: "INVALID_DATE", message: "La fecha no es valida" } });
    return;
  }

  const [rows, studentIndex] = await Promise.all([
    getLiveNovedadesForStudents(codigos),
    getLiveStudentIndex(),
  ]);

  const activas: Record<string, LiveNovedad[]> = {};
  for (const row of rows) {
    if (!matchesExtracurricularDay(row, studentIndex)) continue;
    if (!isRelevantNovedad(row)) continue;
    if (!isOnDay(row, bounds)) continue;
    (activas[row.codigoEstudiante] = activas[row.codigoEstudiante] || []).push(row);
  }

  res.json({
    success: true,
    data: codigos.map((codigo) => ({
      codigoEstudiante: codigo,
      novedades: (activas[codigo] || []).sort(sortNewestFirst).map(serialize),
    })),
  });
}

export async function getNovedadesDiarias(req: Request, res: Response): Promise<void> {
  const fechaParam = String(req.query.fecha || "").trim();
  const grado = String(req.query.grado || "").trim();
  const bounds = fechaParam ? dayBounds(fechaParam) : dayBounds(new Date().toISOString());
  if (!bounds) {
    res.status(400).json({ success: false, error: { code: "INVALID_DATE", message: "La fecha no es valida" } });
    return;
  }

  const [rows, studentIndex] = await Promise.all([
    getLiveNovedades(),
    getLiveStudentIndex(),
  ]);

  const data = rows
    .filter((row) => isOnDay(row, bounds))
    .filter((row) => {
      if (!grado) return true;
      const student = studentIndex.get(row.codigoEstudiante);
      return student?.grado === grado || row.grados === grado;
    })
    .filter(isRelevantNovedad)
    .sort(sortNewestFirst)
    .map((row) => {
      const student = studentIndex.get(row.codigoEstudiante) || fallbackStudent(row);
      return {
        estudiante: {
          codigoEstudiante: row.codigoEstudiante,
          nombre: student.nombre || "Estudiante",
          apellido: student.apellido || "",
          grupo: student.grupo || null,
          grado: student.grado || row.grados || null,
          fotoUrl: student.fotoUrl || null,
        },
        novedad: serialize(row),
      };
    });

  res.json({ success: true, data });
}
