import mysql from "mysql2/promise";
import { config } from "../config";

let pool: mysql.Pool | null = null;

/** Pool lazy: no abre conexiones hasta la primera query. */
export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      waitForConnections: true,
      connectionLimit: 10,
      connectTimeout: config.db.connectTimeoutMS,
      charset: "utf8mb4",
      timezone: "Z",
      // Los timestamps llegan como "YYYY-MM-DD HH:MM:SS" y se normalizan a ISO
      // con utils/colombiaTime; nunca como objetos Date (evita saltos de zona).
      dateStrings: true,
    });
  }
  return pool;
}

export async function query<T extends object[] = mysql.RowDataPacket[]>(
  sql: string,
  params?: any[],
): Promise<T> {
  const [rows] = await getPool().execute(sql, params);
  return rows as T;
}

export async function queryOne<T extends object = mysql.RowDataPacket>(
  sql: string,
  params?: any[],
): Promise<T | null> {
  const rows = await query<T[]>(sql, params);
  return rows[0] ?? null;
}

export async function execute(
  sql: string,
  params?: any[],
): Promise<mysql.ResultSetHeader> {
  const [result] = await getPool().execute(sql, params);
  return result as mysql.ResultSetHeader;
}

export async function transaction<T>(fn: (conn: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}