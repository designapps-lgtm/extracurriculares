import { sql } from "../../config/db";
import type { ParsedNovedadRow } from "./novedades.parser";

type PersistOptions = {
  replaceSources?: string[];
};

function deduplicate(rows: ParsedNovedadRow[]): ParsedNovedadRow[] {
  const unique = new Map<string, ParsedNovedadRow>();
  for (const row of rows) {
    unique.set(`${row.novedadId}\u0000${row.codigoEstudiante}`, row);
  }
  return [...unique.values()];
}

/**
 * Persiste un snapshot de novedades en una sola transacción HTTP de Neon.
 * Cuando replaceSources está definido, el snapshot anterior se elimina incluso
 * si rows está vacío; esto permite representar correctamente un día sin novedades.
 */
export async function persistNovedades(
  source: string,
  rows: ParsedNovedadRow[],
  options: PersistOptions = {},
): Promise<number> {
  const normalizedRows = deduplicate(rows);
  const replaceSources = [...new Set(
    (options.replaceSources || []).map((value) => value.toLowerCase()),
  )];

  if (normalizedRows.length === 0) {
    if (replaceSources.length > 0) {
      await sql`DELETE FROM "Novedad" WHERE LOWER("archivo") = ANY(${replaceSources})`;
    }
    return 0;
  }

  const payload = normalizedRows.map((row) => ({
    novedadId: row.novedadId,
    codigoEstudiante: row.codigoEstudiante,
    descripcion: row.descripcion || null,
    seAusentaCon: row.seAusentaCon || null,
    seAusentaConOtro: row.seAusentaConOtro || null,
    seAusentaConTipo: row.seAusentaConTipo || null,
    tipoNovedad: row.tipoNovedad || null,
    flujoNovedad: row.flujoNovedad || null,
    grados: row.grados || null,
    nombresEstudiantes: row.nombresEstudiantes || null,
    fotoUrls: row.fotoUrls || null,
    fechaHora: row.fechaHora?.toISOString() || null,
    scanCodes: row.scanCodes || null,
    fechaCreacion: row.fechaCreacion?.toISOString() || null,
    registradoPor: row.registradoPor || null,
    procesado: row.procesado || null,
    regresaAlColegio: row.regresaAlColegio,
    horaEstimadaRegreso: row.horaEstimadaRegreso || null,
    fechaNovedad: row.fechaNovedad?.toISOString() || null,
  }));

  await sql.transaction((tx) => {
    const queries = [];
    if (replaceSources.length > 0) {
      queries.push(tx`DELETE FROM "Novedad" WHERE LOWER("archivo") = ANY(${replaceSources})`);
    }
    queries.push(tx`
    INSERT INTO "Novedad" (
      "id", "novedadId", "archivo", "codigoEstudiante", "descripcion",
      "seAusentaCon", "seAusentaConOtro", "seAusentaConTipo",
      "tipoNovedad", "flujoNovedad", "grados", "nombresEstudiantes",
      "fotoUrls", "fechaHora", "scanCodes", "fechaCreacion",
      "registradoPor", "procesado", "regresaAlColegio",
      "horaEstimadaRegreso", "fechaNovedad", "updatedAt"
    )
    SELECT
      gen_random_uuid(), r."novedadId", ${source}, r."codigoEstudiante", r."descripcion",
      r."seAusentaCon", r."seAusentaConOtro", r."seAusentaConTipo",
      r."tipoNovedad", r."flujoNovedad", r."grados", r."nombresEstudiantes",
      r."fotoUrls", r."fechaHora", r."scanCodes", r."fechaCreacion",
      r."registradoPor", r."procesado", r."regresaAlColegio",
      r."horaEstimadaRegreso", r."fechaNovedad", now()
    FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb) AS r(
      "novedadId" text,
      "codigoEstudiante" text,
      "descripcion" text,
      "seAusentaCon" text,
      "seAusentaConOtro" text,
      "seAusentaConTipo" text,
      "tipoNovedad" text,
      "flujoNovedad" text,
      "grados" text,
      "nombresEstudiantes" text,
      "fotoUrls" text,
      "fechaHora" timestamptz,
      "scanCodes" text,
      "fechaCreacion" timestamptz,
      "registradoPor" text,
      "procesado" text,
      "regresaAlColegio" boolean,
      "horaEstimadaRegreso" text,
      "fechaNovedad" timestamptz
    )
    ON CONFLICT ("novedadId", "codigoEstudiante") DO UPDATE SET
      "archivo" = EXCLUDED."archivo",
      "descripcion" = EXCLUDED."descripcion",
      "seAusentaCon" = EXCLUDED."seAusentaCon",
      "seAusentaConOtro" = EXCLUDED."seAusentaConOtro",
      "seAusentaConTipo" = EXCLUDED."seAusentaConTipo",
      "tipoNovedad" = EXCLUDED."tipoNovedad",
      "flujoNovedad" = EXCLUDED."flujoNovedad",
      "grados" = EXCLUDED."grados",
      "nombresEstudiantes" = EXCLUDED."nombresEstudiantes",
      "fotoUrls" = EXCLUDED."fotoUrls",
      "fechaHora" = EXCLUDED."fechaHora",
      "scanCodes" = EXCLUDED."scanCodes",
      "fechaCreacion" = EXCLUDED."fechaCreacion",
      "registradoPor" = EXCLUDED."registradoPor",
      "procesado" = EXCLUDED."procesado",
      "regresaAlColegio" = EXCLUDED."regresaAlColegio",
      "horaEstimadaRegreso" = EXCLUDED."horaEstimadaRegreso",
      "fechaNovedad" = EXCLUDED."fechaNovedad",
      "updatedAt" = now()
  `);
    return queries;
  });
  return normalizedRows.length;
}
