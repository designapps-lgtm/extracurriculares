import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

export async function runMigrations(pool: mysql.Pool): Promise<string[]> {
  const conn = await pool.getConnection();
  try {
    await conn.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_schema_migrations_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    const [rows] = await conn.query<mysql.RowDataPacket[]>("SELECT name FROM schema_migrations");
    const applied = new Set(rows.map((row) => row.name as string));

    const freshlyApplied: string[] = [];
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      await conn.beginTransaction();
      try {
        for (const statement of splitStatements(sql)) {
          await conn.query(statement);
        }
        await conn.query("INSERT INTO schema_migrations (name) VALUES (?)", [file]);
        await conn.commit();
        freshlyApplied.push(file);
      } catch (error) {
        await conn.rollback();
        throw new Error(`Migración ${file} falló: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return freshlyApplied;
  } finally {
    conn.release();
  }
}

function splitStatements(sql: string): string[] {
  const withoutComments = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  return withoutComments
    .split(/;\s*(?:\n|$)/)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

export async function migrate(): Promise<void> {
  const { getPool } = await import("./mysql");
  const pool = getPool();
  const applied = await runMigrations(pool);
  if (applied.length === 0) {
    console.log("[db] Sin migraciones pendientes");
  } else {
    for (const name of applied) console.log(`[db] Aplicada: ${name}`);
  }
  await pool.end();
}

if (require.main === module) {
  migrate().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}