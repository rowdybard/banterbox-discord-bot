// Simple database migration to add passwordHash column
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migrate() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Running database migration...');
    
    // Check if passwordHash column exists
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'password_hash'
    `);
    
    if (columnCheck.rows.length === 0) {
      console.log('➕ Adding passwordHash column to users table...');
      await client.query(`
        ALTER TABLE users 
        ADD COLUMN password_hash VARCHAR(255)
      `);
      console.log('✅ passwordHash column added successfully');
    } else {
      console.log('✅ passwordHash column already exists');
    }
    
    // Create sessions table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid VARCHAR NOT NULL COLLATE "default",
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL
      );
    `);
    
    // Create unique index on sessions.sid if it doesn't exist
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS IDX_session_sid ON sessions (sid);
    `);
    
    // Create index on sessions.expire if it doesn't exist
    await client.query(`
      CREATE INDEX IF NOT EXISTS IDX_session_expire ON sessions (expire);
    `);
    
    console.log('✅ Sessions table configured');
    console.log('🎉 Database migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
