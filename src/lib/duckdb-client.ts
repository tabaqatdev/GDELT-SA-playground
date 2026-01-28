/// <reference types="vite/client" />
import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import { Table } from 'apache-arrow';



let dbInstance: duckdb.AsyncDuckDB | null = null;
let connInstance: duckdb.AsyncDuckDBConnection | null = null;

export async function initializeDuckDB(): Promise<duckdb.AsyncDuckDB> {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    // Manual bundle with local WASM files
    const manualBundle: duckdb.DuckDBBundle = {
      mainModule: duckdb_wasm,
      mainWorker: new URL('@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js', import.meta.url).href,
      pthreadWorker: null
    };

    const worker = new Worker(manualBundle.mainWorker as string);
    const logger = new duckdb.ConsoleLogger();
    const db = new duckdb.AsyncDuckDB(logger, worker);

    await db.instantiate(manualBundle.mainModule);

    dbInstance = db;
    return db;
  } catch (error) {
    console.error('Failed to initialize DuckDB:', error);
    throw error;
  }
}

export async function getConnection(): Promise<duckdb.AsyncDuckDBConnection> {
  if (!dbInstance) {
    await initializeDuckDB();
  }

  if (!connInstance) {
    connInstance = await dbInstance!.connect();
  }

  return connInstance;
}

export async function executeQuery(sql: string): Promise<Table> {
  const conn = await getConnection();
  const result = await conn.query(sql);
  // Cast to unknown first to bypass version mismatch between duckdb-wasm's arrow and our installed arrow
  return result as unknown as Table;
}

export async function registerParquetFile(name: string, url: string): Promise<void> {
  const db = await initializeDuckDB();
  await db.registerFileURL(name, url, duckdb.DuckDBDataProtocol.HTTP, true);
}

export async function installExtension(name: string): Promise<void> {
  const conn = await getConnection();
  await conn.query(`INSTALL ${name};`);
  await conn.query(`LOAD ${name};`);
}

export function closeDuckDB() {
  if (connInstance) {
    connInstance.close();
    connInstance = null;
  }
  if (dbInstance) {
    dbInstance.terminate();
    dbInstance = null;
  }
}
