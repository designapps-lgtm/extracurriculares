import { describe, expect, it, beforeAll, afterAll } from "vitest";
import mysql from "mysql2/promise";

// Test de integración: requiere el servicio MySQL levantado (docker compose up -d mysql).
// Usa una base dedicada `extracurriculares_test` para no tocar la de desarrollo.

const TEST_DB = process.env.DB_TEST_NAME || "extracurriculares_test";

let admin: mysql.Pool;
let pool: mysql.Pool;

async function ensureTestDb(): Promise<void> {
  admin = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "app",
    password: process.env.DB_PASSWORD || "app-local-dev",
    connectionLimit: 1,
  });
  await admin.execute(`CREATE DATABASE IF NOT EXISTS \`${TEST_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await admin.end();
  pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "app",
    password: process.env.DB_PASSWORD || "app-local-dev",
    database: TEST_DB,
    connectionLimit: 2,
  });
}

async function dropAllTables(): Promise<void> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>("SHOW TABLES");
  const tableKey = `Tables_in_${TEST_DB}`;
  const names = rows.map((row) => row[tableKey] as string);
  if (names.length === 0) return;
  await pool.query(`SET FOREIGN_KEY_CHECKS = 0`);
  for (const name of names) await pool.query(`DROP TABLE IF EXISTS \`${name}\``);
  await pool.query(`SET FOREIGN_KEY_CHECKS = 1`);
}

beforeAll(async () => {
  await ensureTestDb();
  await dropAllTables();
});

afterAll(async () => {
  await pool?.end().catch(() => undefined);
  await admin?.end().catch(() => undefined);
});

describe("runner de migraciones", () => {
  it("crea todas las tablas del schema", async () => {
    const { runMigrations } = await import("./migrate");
    await runMigrations(pool);

    const [rows] = await pool.query<mysql.RowDataPacket[]>("SHOW TABLES");
    const tableKey = `Tables_in_${TEST_DB}`;
    const tables = rows.map((row) => row[tableKey] as string);

    expect(tables).toEqual(expect.arrayContaining([
      "schema_migrations",
      "users",
      "grades",
      "schedules",
      "students",
      "enrollments",
      "assignments",
      "assignment_schedules",
      "attendance",
      "stays",
      "reports",
      "audit_log",
      "sync_state",
      "demographics",
      "student_routes",
    ]));
  });

  it("es idempotente: correr dos veces no rompe nada", async () => {
    const { runMigrations } = await import("./migrate");
    await runMigrations(pool);
    await runMigrations(pool);
    const [rows] = await pool.query<mysql.RowDataPacket[]>("SELECT COUNT(*) AS c FROM schema_migrations");
    const applied = Number((rows[0] as { c: number }).c);
    expect(applied).toBeGreaterThan(0);
  });

  it("users tiene las columnas esperadas por el dominio", async () => {
    const [cols] = await pool.query<mysql.RowDataPacket[]>("SHOW COLUMNS FROM users");
    const names = cols.map((col) => col.Field as string);
    expect(names).toEqual(expect.arrayContaining([
      "id", "role", "code", "email", "first_name", "last_name", "photo_url",
      "status", "can_view_students", "can_manage_news", "can_manage_attendance",
      "can_manage_schedules", "can_administer_users", "created_at", "updated_at",
    ]));
  });

  it("enrollments tiene un constraint UNIQUE por estudiante+disciplina+día", async () => {
    const [indexes] = await pool.query<mysql.RowDataPacket[]>("SHOW INDEX FROM enrollments");
    const uniqueColumns = indexes
      .filter((index) => index.Non_unique === 0)
      .map((index) => index.Column_name as string);
    expect(uniqueColumns).toEqual(expect.arrayContaining(["student_code", "discipline_code", "day"]));
  });

  it("attendance no permite duplicar asistencia por sesión+estudiante", async () => {
    const [indexes] = await pool.query<mysql.RowDataPacket[]>("SHOW INDEX FROM attendance");
    const uniqueColumns = indexes
      .filter((index) => index.Non_unique === 0)
      .map((index) => index.Column_name as string);
    expect(uniqueColumns).toEqual(expect.arrayContaining(["session_id", "student_code"]));
  });

  it("stays no permite duplicar permanencia por asignación+horario+estudiante+fecha", async () => {
    const [indexes] = await pool.query<mysql.RowDataPacket[]>("SHOW INDEX FROM stays");
    const uniqueColumns = indexes
      .filter((index) => index.Non_unique === 0)
      .map((index) => index.Column_name as string);
    expect(uniqueColumns).toEqual(expect.arrayContaining(["assignment_id", "schedule_id", "student_code", "date"]));
  });
});