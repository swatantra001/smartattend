import { Pool, PoolClient } from 'pg';
import { logger } from './logger';

class Database {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,                    // max pool connections
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected PostgreSQL pool error:', err);
    });
  }

  async connect(): Promise<void> {
    const client = await this.pool.connect();
    client.release();
  }

  // Simple query
  async query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      if (duration > 1000) {
        logger.warn('Slow query detected', { text, duration });
      }
      return { rows: result.rows, rowCount: result.rowCount ?? 0 };
    } catch (err) {
      logger.error('Database query error:', { text, params, err });
      throw err;
    }
  }

  // Transaction helper
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // Single row helper
  async queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
    const { rows } = await this.query<T>(text, params);
    return rows[0] ?? null;
  }

  async end(): Promise<void> {
    await this.pool.end();
  }
}

export const db = new Database();