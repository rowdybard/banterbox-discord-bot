// Database configuration - now supports Firebase
import { Pool } from "pg";

// Only create PostgreSQL pool if DATABASE_URL is provided
let pool: Pool | null = null;

if (process.env.DATABASE_URL) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  console.log('✅ PostgreSQL connection pool created');
} else {
  console.log('ℹ️  No DATABASE_URL provided - using Firebase Firestore');
}

export { pool };

// Export a dummy db object for compatibility with existing code
export const db = {
  select: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }),
  insert: () => ({ into: () => ({ values: () => Promise.resolve([]) }) }),
  update: () => ({ set: () => ({ where: () => Promise.resolve([]) }) }),
  delete: () => ({ from: () => ({ where: () => Promise.resolve([]) }) })
};