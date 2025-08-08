import { Pool, PoolClient } from 'pg';

declare global {
  var __pool: Pool | undefined;
}

let pool: Pool;

if (process.env.NODE_ENV === 'production') {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
} else {
  // In development, use a global variable to preserve the connection across hot reloads
  if (!global.__pool) {
    global.__pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  pool = global.__pool;
}

export { pool };

// Helper function to execute queries
export async function query<T = unknown>(text: string, params?: ReadonlyArray<string | number | boolean | null>): Promise<{ rows: T[]; rowCount: number }> {
  const client = await pool.connect();
  try {
    let result;
    if (params && params.length > 0) {
      result = await client.query<T>(text, params as ReadonlyArray<string | number | boolean | null>);
    } else {
      result = await client.query<T>(text);
    }
    return { rows: result.rows, rowCount: (result as unknown as { rowCount?: number }).rowCount ?? result.rows.length };
  } finally {
    client.release();
  }
}

// Helper function for transactions
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Database initialization function
export async function initializeDatabase(): Promise<void> {
  try {
    // Check if the database connection is working
    await query('SELECT 1');
    console.log('✅ Database connection established');

    // Check if required extensions are installed
    const extensionCheck = await query(`
      SELECT extname FROM pg_extension 
      WHERE extname IN ('vector', 'uuid-ossp')
    `);
    
    const installedExtensions = extensionCheck.rows.map((row: { extname: string }) => row.extname);
    
    if (!installedExtensions.includes('vector')) {
      console.warn('⚠️  pgvector extension not found. Please install it manually.');
    }
    
    if (!installedExtensions.includes('uuid-ossp')) {
      console.warn('⚠️  uuid-ossp extension not found. Please install it manually.');
    }

    if (installedExtensions.length === 2) {
      console.log('✅ All required database extensions are installed');
    }

  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}