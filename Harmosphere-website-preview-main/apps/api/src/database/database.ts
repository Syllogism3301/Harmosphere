import { Injectable, Inject, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, QueryResultRow } from 'pg';
import { CONFIG, Config } from '../config';

export interface Sql {
  query<T extends QueryResultRow = any>(text: string, values?: any[]): Promise<{ rows: T[]; rowCount?: number | null }>;
}
export const DATABASE = Symbol('DATABASE');
export interface Database extends Sql { transaction<T>(work: (sql: Sql) => Promise<T>): Promise<T>; }

@Injectable()
export class PostgresDatabase implements Database, OnModuleDestroy {
  private readonly pool: Pool;
  constructor(@Inject(CONFIG) config: Config) {
    this.pool = new Pool({ connectionString: config.DATABASE_URL, max: 10, connectionTimeoutMillis: 5000, statement_timeout: 10000 });
  }
  query<T extends QueryResultRow = any>(text: string, values?: any[]) { return this.pool.query<T>(text, values); }
  async transaction<T>(work: (sql: Sql) => Promise<T>) {
    const client: PoolClient = await this.pool.connect();
    try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  async onModuleDestroy() { await this.pool.end(); }
}
