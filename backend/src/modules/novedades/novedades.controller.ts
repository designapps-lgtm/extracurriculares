import { Request, Response } from "express";
import { sql } from "../../config/db";
import { getNovedadesForStudent, syncNovedadesFromDrive } from "./novedades.service";
import { syncAppSheetNovedades } from "../appsheet/appsheet.novedades";
import { dayBounds, isOnDay, isActive } from "./novedades.dates";
import { presentNovedad, listNovedadCatalog } from "./novedades.catalog";

async function refreshNovedades(): Promise<void> {
  try {
    await Promise.all([
      syncNovedadesFromDrive(),
      syncAppSheetNovedades(),
    ]);
  } catch (e: any) {
    console.error("[Novedades] Error en refresh on-demand:", e?.message || e);
  }
}

function isRelevantNovedad(n: any): boolean {
  // Una novedad puede ser informativa y no contener palabras de salida/ausencia.
  return Boolean(n.novedadId);
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
    novedadMeta: presentNovedad(n),
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

export async function getNovedadesCatalogo(_req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: listNovedadCatalog() });
}

export async function getNovedadesByCodigo(req: Request, res: Response): Promise<void> {
  const codigoEstudiante = String(req.params.codigoEstudiante || "");
  await refreshNovedades();
  const todos = await getNovedadesForStudent(codigoEstudiante);
  res.json({ success: true, data: todos.filter(isRelevantNovedad).map(serialize) });
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
    ORDER BY COALESCE("fechaNovedad", "fechaHora", "fechaCreacion") DESC NULLS LAST
  `) as unknown as any[];

  const bounds = fechaParam ? dayBounds(fechaParam) : null;
  const activas: Record<string, any[]> = {};
  for (const r of rows) {
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
           s."grupo" AS "estudianteGrupo", s."fotoUrl" AS "estudianteFotoUrl",
           g."nombre" AS "estudianteGrado"
    FROM "Novedad" n
    LEFT JOIN "Student" s ON s."codigoEstudiante" = n."codigoEstudiante"
    LEFT JOIN "Grade" g ON g."idGrado" = s."idGrado"
    WHERE COALESCE(n."fechaNovedad", n."fechaHora", n."fechaCreacion") >= ${bounds.start}
      AND COALESCE(n."fechaNovedad", n."fechaHora", n."fechaCreacion") < ${bounds.end}
    AND (${grado} = '' OR g."nombre" = ${grado})
    ORDER BY COALESCE(n."fechaNovedad", n."fechaHora", n."fechaCreacion") DESC
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
        fotoUrl: row.estudianteFotoUrl || null,
      },
      novedad: serialize(row),
    })),
  });
}
