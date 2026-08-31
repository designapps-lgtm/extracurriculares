import { neon } from "@neondatabase/serverless";

// Query-layer central para Cloudflare Workers (y Node.js).
//
// Usamos el driver HTTP `neon()` de @neondatabase/serverless, que funciona en
// ambos runtimes (Workers edge y Node 18+) sin conexión persistente ni código
// dual. Esto reemplaza a Prisma: el driver HTTP soporta timestamps (los
// devuelve como Date/string) y transacciones (`sql.transaction(...)`), a
// diferencia de `PrismaNeonHTTP`.
//
// Patrón de uso:
//   import { sql, first } from "../config/db";
//   const rows = await sql`SELECT * FROM "Student" WHERE "codigoEstudiante" = ${codigo}`;
//   const row  = await first(rows);
//   await sql`UPDATE ... SET ... WHERE ...`;
//   await sql.transaction(tx => [ tx`DELETE ...`, tx`INSERT ...` ]);
const connectionString = process.env.DATABASE_URL || "";

if (!connectionString) {
  throw new Error("DATABASE_URL es obligatorio");
}

export const sql = neon(connectionString);

// Devuelve la primera fila de un resultado, o null si el resultado está vacío.
export async function first<T>(rows: T[]): Promise<T | null> {
  return rows.length > 0 ? rows[0] : null;
}

// Devuelve la primera fila, lanzando si no existe. Para lecturas que deben
// garantizar presencia (findUnique de Prisma convertido).
export async function must<T>(rows: T[]): Promise<T> {
  if (rows.length === 0) {
    const e: any = new Error(
      "El registro solicitado no existe."
    );
    e.clientCode = "NOT_FOUND";
    throw e;
  }
  return rows[0];
}
