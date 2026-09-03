import { Request, Response } from "express";
import { sql } from "../../config/db";
import { getNovedadesForStudent, syncNovedadesFromDrive } from "./novedades.service";
import { dayBounds, isOnDay, isActive, novedadDayName } from "./novedades.dates";

async function refreshNovedades(): Promise<void> {
  try {
    await syncNovedadesFromDrive();
  } catch (e: any) {
    console.error("[Novedades] Error en refresh on-demand:", e?.message || e);
  }
}

// Días de extracurricular por estudiante (StudentSchedule.diaSemana).
async function getStudentDays(codigos: string[]): Promise<Map<string, Set<string>>> {
  const rows = (await sql`
    SELECT "codigoEstudiante", "diaSemana"
    FROM "StudentSchedule"
    WHERE "codigoEstudiante" = ANY(${codigos})
  `) as unknown as Array<{ codigoEstudiante: string; diaSemana: string }>;

  const map = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!map.has(r.codigoEstudiante)) map.set(r.codigoEstudiante, new Set());
    map.get(r.codigoEstudiante)!.add(r.diaSemana);
  }
  return map;
}

// Una novedad solo se muestra si se hizo el mismo día que el estudiante tiene extracurricular.
function matchesExtracurricularDay(n: any, daysByStudent: Map<string, Set<string>>): boolean {
  const days = daysByStudent.get(n.codigoEstudiante);
  if (!days || days.size === 0) return false;
  return days.has(novedadDayName(n));
}

function isRelevantNovedad(n: any): boolean {
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

function serialize(n: any) {
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

export async function getNovedadesByCodigo(req: Request, res: Response): Promise<void> {
  const codigoEstudiante = String(req.params.codigoEstudiante || "");
  await refreshNovedades();
  const todos = await getNovedadesForStudent(codigoEstudiante);
  const daysByStudent = await getStudentDays([codigoEstudiante]);
  const filtered = todos.filter((n) => matchesExtracurricularDay(n, daysByStudent));
  res.json({ success: true, data: filtered.filter(isRelevantNovedad).map(serialize) });
}

export async function getNovedadesBatch(req: Request, res: Response): Promise<void> {
  const raw = String(req.query.codigos || "");
  const fechaParam = String(req.query.fecha || "").trim();
  const codigos = raw.split(",").map((c) => c.trim()).filter(Boolean);
  if (codigos.length === 0) {
    res.json({ success: true, data: [] });
    return;
  }

  await refreshNovedades();

  const rows = (await sql`
    SELECT * FROM "Novedad"
    WHERE "codigoEstudiante" = ANY(${codigos})
    ORDER BY "fechaNovedad" DESC NULLS LAST, "fechaCreacion" DESC NULLS LAST
  `) as unknown as any[];

  const bounds = fechaParam ? dayBounds(fechaParam) : null;
  const daysByStudent = await getStudentDays(codigos);
  const activas: Record<string, any[]> = {};
  for (const r of rows) {
    if (!matchesExtracurricularDay(r, daysByStudent)) continue;
    if (!isRelevantNovedad(r)) continue;
    const match = bounds ? isOnDay(r, bounds) : isActive(r);
    if (!match) continue;
    (activas[r.codigoEstudiante] = activas[r.codigoEstudiante] || []).push(serialize(r));
  }

  res.json({ success: true, data: codigos.map((c) => ({ codigoEstudiante: c, novedades: activas[c] || [] })) });
}

export async function getNovedadesDiarias(req: Request, res: Response): Promise<void> {
  await refreshNovedades();

  const fechaParam = String(req.query.fecha || "").trim();
  const grado = String(req.query.grado || "").trim();
  const bounds = fechaParam ? dayBounds(fechaParam) : dayBounds(new Date().toISOString());
  if (!bounds) {
    res.status(400).json({ success: false, error: { code: "INVALID_DATE", message: "La fecha no es válida" } });
    return;
  }

  const rows = (await sql`
    SELECT n.*, s."nombre" AS "estudianteNombre", s."apellido" AS "estudianteApellido",
           s."grupo" AS "estudianteGrupo", g."nombre" AS "estudianteGrado"
    FROM "Novedad" n
    LEFT JOIN "Student" s ON s."codigoEstudiante" = n."codigoEstudiante"
    LEFT JOIN "Grade" g ON g."idGrado" = s."idGrado"
    WHERE (
      (n."fechaNovedad" >= ${bounds.start} AND n."fechaNovedad" < ${bounds.end})
      OR (n."fechaNovedad" IS NULL AND n."fechaCreacion" >= ${bounds.start} AND n."fechaCreacion" < ${bounds.end})
    )
    AND (${grado} = '' OR g."nombre" = ${grado})
    ORDER BY n."fechaNovedad" DESC NULLS LAST, n."fechaCreacion" DESC NULLS LAST
  `) as unknown as any[];

  res.json({
    success: true,
    data: rows.map((row) => ({
      estudiante: {
        codigoEstudiante: row.codigoEstudiante,
        nombre: row.estudianteNombre || "Estudiante",
        apellido: row.estudianteApellido || "",
        grupo: row.estudianteGrupo || null,
        grado: row.estudianteGrado || row.grados || null,
      },
      novedad: serialize(row),
    })),
  });
}
