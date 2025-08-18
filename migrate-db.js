// Comprehensive database migration to add missing columns
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migrate() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Running comprehensive database migration...');
    
    // 1. Add passwordHash column to users table
    const passwordHashCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'password_hash'
    `);
    
    if (passwordHashCheck.rows.length === 0) {
      console.log('➕ Adding passwordHash column to users table...');
      await client.query(`
        ALTER TABLE users 
        ADD COLUMN password_hash VARCHAR(255)
      `);
      console.log('✅ passwordHash column added successfully');
    } else {
      console.log('✅ passwordHash column already exists');
    }
    
    // 2. Add favoritePersonalities column to user_settings table
    const favoritePersonalitiesCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'user_settings' AND column_name = 'favorite_personalities'
    `);
    
    if (favoritePersonalitiesCheck.rows.length === 0) {
      console.log('➕ Adding favoritePersonalities column to user_settings table...');
      await client.query(`
        ALTER TABLE user_settings 
        ADD COLUMN favorite_personalities JSONB DEFAULT '[]'::jsonb
      `);
      console.log('✅ favoritePersonalities column added successfully');
    } else {
      console.log('✅ favoritePersonalities column already exists');
    }
    
    // 3. Add favoriteVoices column to user_settings table
    const favoriteVoicesCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'user_settings' AND column_name = 'favorite_voices'
    `);
    
    if (favoriteVoicesCheck.rows.length === 0) {
      console.log('➕ Adding favoriteVoices column to user_settings table...');
      await client.query(`
        ALTER TABLE user_settings 
        ADD COLUMN favorite_voices JSONB DEFAULT '[]'::jsonb
      `);
      console.log('✅ favoriteVoices column added successfully');
    } else {
      console.log('✅ favoriteVoices column already exists');
    }
    
    // 4. Add originalMessage column to banter_items table
    const banterOriginalMessageCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'banter_items' AND column_name = 'original_message'
    `);
    
    if (banterOriginalMessageCheck.rows.length === 0) {
      console.log('➕ Adding originalMessage column to banter_items table...');
      await client.query(`
        ALTER TABLE banter_items 
        ADD COLUMN original_message TEXT
      `);
      console.log('✅ originalMessage column added to banter_items successfully');
    } else {
      console.log('✅ originalMessage column already exists in banter_items');
    }
    
    // 5. Add originalMessage column to context_memory table
    const contextOriginalMessageCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'context_memory' AND column_name = 'original_message'
    `);
    
    if (contextOriginalMessageCheck.rows.length === 0) {
      console.log('➕ Adding originalMessage column to context_memory table...');
      await client.query(`
        ALTER TABLE context_memory 
        ADD COLUMN original_message TEXT
      `);
      console.log('✅ originalMessage column added to context_memory successfully');
    } else {
      console.log('✅ originalMessage column already exists in context_memory');
    }
    
    // 6. Create sessions table if it doesn't exist
    const sessionsTableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'sessions'
    `);
    
    if (sessionsTableCheck.rows.length === 0) {
      console.log('➕ Creating sessions table...');
      await client.query(`
        CREATE TABLE sessions (
          sid VARCHAR NOT NULL COLLATE "default",
          sess JSON NOT NULL,
          expire TIMESTAMP(6) NOT NULL
        )
      `);
      console.log('✅ Sessions table created');
    } else {
      console.log('✅ Sessions table already exists');
    }
    
    // 7. Create unique index on sessions.sid if it doesn't exist
    const sessionsSidIndexCheck = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'sessions' AND indexname = 'idx_session_sid'
    `);
    
    if (sessionsSidIndexCheck.rows.length === 0) {
      console.log('➕ Creating unique index on sessions.sid...');
      await client.query(`
        CREATE UNIQUE INDEX idx_session_sid ON sessions (sid)
      `);
      console.log('✅ Sessions sid index created');
    } else {
      console.log('✅ Sessions sid index already exists');
    }
    
    // 8. Create index on sessions.expire if it doesn't exist
    const sessionsExpireIndexCheck = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'sessions' AND indexname = 'idx_session_expire'
    `);
    
    if (sessionsExpireIndexCheck.rows.length === 0) {
      console.log('➕ Creating index on sessions.expire...');
      await client.query(`
        CREATE INDEX idx_session_expire ON sessions (expire)
      `);
      console.log('✅ Sessions expire index created');
    } else {
      console.log('✅ Sessions expire index already exists');
    }
    
    console.log('✅ Sessions table configured');
    console.log('🎉 Comprehensive database migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
