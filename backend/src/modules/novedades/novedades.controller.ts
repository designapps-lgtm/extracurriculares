import { Request, Response } from "express";
import prisma from "../../config/prisma";
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
  const codigos = raw.split(",").map((c) => c.trim()).filter(Boolean);
  if (codigos.length === 0) {
    res.json({ success: true, data: [] });
    return;
  }

  const rows = await prisma.novedad.findMany({
    where: { codigoEstudiante: { in: codigos } },
    orderBy: [{ fechaNovedad: "desc" }, { fechaCreacion: "desc" }],
  });

  const activas: Record<string, any[]> = {};
  for (const r of rows) {
    if (!isActive(r)) continue;
    (activas[r.codigoEstudiante] = activas[r.codigoEstudiante] || []).push(serialize(r));
  }

  res.json({ success: true, data: codigos.map((c) => ({ codigoEstudiante: c, novedades: activas[c] || [] })) });
}