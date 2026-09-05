import { neon } from "@neondatabase/serverless";
import { Pool, type PoolClient } from "pg";

function databaseUrl(): string {
  const connectionString = process.env.DATABASE_URL || "";
  if (!connectionString) {
    throw new Error("DATABASE_URL es obligatorio");
  }
  return connectionString;
}

function usesLocalPostgres(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "postgres" || host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

type SqlInput = TemplateStringsArray | string;

interface SqlClient {
  (query: TemplateStringsArray, ...values: unknown[]): Promise<any[]>;
  (query: string, values?: unknown[]): Promise<any[]>;
  transaction<T>(callback: (tx: SqlClient) => Promise<T> | T): Promise<T>;
}

type LocalQueryExecutor = Pick<Pool, "query"> | Pick<PoolClient, "query">;

function createLocalSql(executor: LocalQueryExecutor, pool: Pool): SqlClient {
  const query = (async (input: SqlInput, ...values: unknown[]): Promise<any[]> => {
    if (typeof input === "string") {
      const params = Array.isArray(values[0]) ? values[0] : values;
      const result = await executor.query(input, params);
      return result.rows;
    }

    let text = input[0];
    for (let index = 0; index < values.length; index++) {
      text += `$${index + 1}${input[index + 1]}`;
    }
    const result = await executor.query(text, values);
    return result.rows;
  }) as SqlClient;

  query.transaction = async <T>(callback: (tx: SqlClient) => Promise<T> | T): Promise<T> => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await callback(createLocalSql(client, pool));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  };

  return query;
}

let cachedSql: SqlClient | null = null;
let localPool: Pool | null = null;

function getSql(): SqlClient {
  if (cachedSql) return cachedSql;

  const connectionString = databaseUrl();
  if (usesLocalPostgres(connectionString)) {
    localPool = new Pool({ connectionString });
    cachedSql = createLocalSql(localPool, localPool);
  } else {
    cachedSql = neon(connectionString) as unknown as SqlClient;
  }

  return cachedSql;
}

export const sql = (async (input: SqlInput, ...values: unknown[]) => {
  return getSql()(input as any, ...values);
}) as SqlClient;

sql.transaction = async <T>(callback: (tx: SqlClient) => Promise<T> | T): Promise<T> => {
  return getSql().transaction(callback);
};

// Devuelve la primera fila de un resultado, o null si el resultado esta vacio.
export async function first<T>(rows: T[]): Promise<T | null> {
  return rows.length > 0 ? rows[0] : null;
}

// Devuelve la primera fila, lanzando si no existe.
export async function must<T>(rows: T[]): Promise<T> {
  if (rows.length === 0) {
    const e: any = new Error("El registro solicitado no existe.");
    e.clientCode = "NOT_FOUND";
    throw e;
  }
  return rows[0];
}
