// Comprehensive database migration to add missing columns - Fixed schema issues
import pkg from 'pg';
const { Pool } = pkg;

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  console.log('Please set DATABASE_URL to your database connection string');
  process.exit(1);
}

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
    
    // 2. Add subscription_tier column to users table
    const subscriptionTierCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'subscription_tier'
    `);
    
    if (subscriptionTierCheck.rows.length === 0) {
      console.log('➕ Adding subscription_tier column to users table...');
      await client.query(`
        ALTER TABLE users 
        ADD COLUMN subscription_tier TEXT DEFAULT 'free'
      `);
      console.log('✅ subscription_tier column added successfully');
    } else {
      console.log('✅ subscription_tier column already exists');
    }
    
    // 3. Add subscription_status column to users table
    const subscriptionStatusCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'subscription_status'
    `);
    
    if (subscriptionStatusCheck.rows.length === 0) {
      console.log('➕ Adding subscription_status column to users table...');
      await client.query(`
        ALTER TABLE users 
        ADD COLUMN subscription_status TEXT DEFAULT 'active'
      `);
      console.log('✅ subscription_status column added successfully');
    } else {
      console.log('✅ subscription_status column already exists');
    }
    
    // 4. Add subscription_id column to users table
    const subscriptionIdCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'subscription_id'
    `);
    
    if (subscriptionIdCheck.rows.length === 0) {
      console.log('➕ Adding subscription_id column to users table...');
      await client.query(`
        ALTER TABLE users 
        ADD COLUMN subscription_id VARCHAR(255)
      `);
      console.log('✅ subscription_id column added successfully');
    } else {
      console.log('✅ subscription_id column already exists');
    }
    
    // 5. Add trial_ends_at column to users table
    const trialEndsAtCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'trial_ends_at'
    `);
    
    if (trialEndsAtCheck.rows.length === 0) {
      console.log('➕ Adding trial_ends_at column to users table...');
      await client.query(`
        ALTER TABLE users 
        ADD COLUMN trial_ends_at TIMESTAMP
      `);
      console.log('✅ trial_ends_at column added successfully');
    } else {
      console.log('✅ trial_ends_at column already exists');
    }
    
    // 6. Add current_period_end column to users table
    const currentPeriodEndCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'current_period_end'
    `);
    
    if (currentPeriodEndCheck.rows.length === 0) {
      console.log('➕ Adding current_period_end column to users table...');
      await client.query(`
        ALTER TABLE users 
        ADD COLUMN current_period_end TIMESTAMP
      `);
      console.log('✅ current_period_end column added successfully');
    } else {
      console.log('✅ current_period_end column already exists');
    }
    
    // 7. Add favoritePersonalities column to user_settings table
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
    
    // 8. Add favoriteVoices column to user_settings table
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
    
    // 9. Add originalMessage column to banter_items table
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
    
    // 10. Add originalMessage column to context_memory table
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
    
    // 11. Add banterResponse column to context_memory table
    const contextBanterResponseCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'context_memory' AND column_name = 'banter_response'
    `);
    
    if (contextBanterResponseCheck.rows.length === 0) {
      console.log('➕ Adding banterResponse column to context_memory table...');
      await client.query(`
        ALTER TABLE context_memory 
        ADD COLUMN banter_response TEXT
      `);
      console.log('✅ banterResponse column added to context_memory successfully');
    } else {
      console.log('✅ banterResponse column already exists in context_memory');
    }
    
    // 12. Create sessions table if it doesn't exist
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
    
    // 13. Create unique index on sessions.sid if it doesn't exist
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
    
    // 14. Create index on sessions.expire if it doesn't exist
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
    
    // 15. Add participants column to context_memory table
    const contextParticipantsCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'context_memory' AND column_name = 'participants'
    `);
    
    if (contextParticipantsCheck.rows.length === 0) {
      console.log('➕ Adding participants column to context_memory table...');
      await client.query(`
        ALTER TABLE context_memory 
        ADD COLUMN participants TEXT[] DEFAULT '{}'
      `);
      console.log('✅ participants column added to context_memory successfully');
    } else {
      console.log('✅ participants column already exists in context_memory');
    }

    // 16. Add last_plan_change_at column to users table
    const lastPlanChangeAtCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'last_plan_change_at'
    `);
    
    if (lastPlanChangeAtCheck.rows.length === 0) {
      console.log('➕ Adding last_plan_change_at column to users table...');
      await client.query(`
        ALTER TABLE users 
        ADD COLUMN last_plan_change_at TIMESTAMP
      `);
      console.log('✅ last_plan_change_at column added successfully');
    } else {
      console.log('✅ last_plan_change_at column already exists');
    }

    // 17. Add plan_change_count column to users table
    const planChangeCountCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'plan_change_count'
    `);
    
    if (planChangeCountCheck.rows.length === 0) {
      console.log('➕ Adding plan_change_count column to users table...');
      await client.query(`
        ALTER TABLE users 
        ADD COLUMN plan_change_count INTEGER DEFAULT 0
      `);
      console.log('✅ plan_change_count column added successfully');
    } else {
      console.log('✅ plan_change_count column already exists');
    }

    // 18. Add response_frequency column to user_settings table
    const responseFrequencyCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'user_settings' AND column_name = 'response_frequency'
    `);
    
    if (responseFrequencyCheck.rows.length === 0) {
      console.log('➕ Adding response_frequency column to user_settings table...');
      await client.query(`
        ALTER TABLE user_settings 
        ADD COLUMN response_frequency INTEGER DEFAULT 50
      `);
      console.log('✅ response_frequency column added successfully');
    } else {
      console.log('✅ response_frequency column already exists');
    }
    
    console.log('✅ Sessions table configured');
    console.log('🎉 Comprehensive database migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Make sure your database is running and DATABASE_URL is correct');
    } else if (error.code === 'ENOTFOUND') {
      console.log('💡 Check that your DATABASE_URL hostname is correct');
    } else if (error.message.includes('password authentication failed')) {
      console.log('💡 Check that your DATABASE_URL username and password are correct');
    }
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
