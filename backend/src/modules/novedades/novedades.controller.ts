import { Request, Response } from "express";
import { sql } from "../../config/db";
import { getNovedadesForStudent } from "./novedades.service";

function todayColombiaStart(): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "0";
  return new Date(`${get("year")}-${get("month")}-${get("day")}T00:00:00`);
}

function isActive(n: { fechaNovedad: Date | null; fechaCreacion: Date | null }): boolean {
  const todayStart = todayColombiaStart();
  if (n.fechaNovedad) return n.fechaNovedad >= todayStart;
  if (n.fechaCreacion) return n.fechaCreacion >= todayStart;
  return false;
}

function dayBounds(fechaISO: string): { start: Date; end: Date } | null {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(fechaISO);
  if (dateOnly) {
    const start = new Date(`${fechaISO}T05:00:00.000Z`);
    if (isNaN(start.getTime())) return null;
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }

  const d = new Date(fechaISO);
  if (isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "0";
  const start = new Date(`${get("year")}-${get("month")}-${get("day")}T05:00:00.000Z`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function isOnDay(n: { fechaNovedad: Date | null; fechaCreacion: Date | null }, bounds: { start: Date; end: Date }): boolean {
  const d = n.fechaNovedad || n.fechaCreacion;
  if (!d) return false;
  return d >= bounds.start && d < bounds.end;
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
  const todos = await getNovedadesForStudent(codigoEstudiante);
  res.json({ success: true, data: todos.map(serialize) });
}

export async function getNovedadesBatch(req: Request, res: Response): Promise<void> {
  const raw = String(req.query.codigos || "");
  const fechaParam = String(req.query.fecha || "").trim();
  const codigos = raw.split(",").map((c) => c.trim()).filter(Boolean);
  if (codigos.length === 0) {
    res.json({ success: true, data: [] });
    return;
  }

  const rows = (await sql`
    SELECT * FROM "Novedad"
    WHERE "codigoEstudiante" = ANY(${codigos})
    ORDER BY "fechaNovedad" DESC NULLS LAST, "fechaCreacion" DESC NULLS LAST
  `) as unknown as any[];

  const bounds = fechaParam ? dayBounds(fechaParam) : null;
  const activas: Record<string, any[]> = {};
  for (const r of rows) {
    const match = bounds ? isOnDay(r, bounds) : isActive(r);
    if (!match) continue;
    (activas[r.codigoEstudiante] = activas[r.codigoEstudiante] || []).push(serialize(r));
  }

  res.json({ success: true, data: codigos.map((c) => ({ codigoEstudiante: c, novedades: activas[c] || [] })) });
}
