import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set!');
  console.error('Please set it in your environment variables.');
  process.exit(1);
}

console.log('🚀 Starting marketplace database migration...');

// Create database connection using the same setup as the main app
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function runMigration() {
  try {
    console.log('📊 Creating marketplace tables...');
    
    // Create marketplace_voices table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS marketplace_voices (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        description TEXT,
        category VARCHAR NOT NULL,
        tags TEXT[] DEFAULT '{}',
        voice_id VARCHAR NOT NULL,
        base_voice_id VARCHAR,
        settings JSONB NOT NULL,
        sample_text TEXT,
        sample_audio_url TEXT,
        author_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        author_name VARCHAR NOT NULL,
        is_verified BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        downloads INTEGER DEFAULT 0,
        upvotes INTEGER DEFAULT 0,
        downvotes INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        moderation_status VARCHAR DEFAULT 'pending',
        moderation_notes TEXT,
        moderated_at TIMESTAMP,
        moderated_by VARCHAR REFERENCES users(id)
      );
    `);
    console.log('✅ marketplace_voices table created');
    
    // Create marketplace_personalities table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS marketplace_personalities (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        description TEXT,
        prompt TEXT NOT NULL,
        category VARCHAR NOT NULL,
        tags TEXT[] DEFAULT '{}',
        author_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        author_name VARCHAR NOT NULL,
        is_verified BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        downloads INTEGER DEFAULT 0,
        upvotes INTEGER DEFAULT 0,
        downvotes INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        moderation_status VARCHAR DEFAULT 'pending',
        moderation_notes TEXT,
        moderated_at TIMESTAMP,
        moderated_by VARCHAR REFERENCES users(id)
      );
    `);
    console.log('✅ marketplace_personalities table created');
    
    // Create user_downloads table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_downloads (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        item_type VARCHAR NOT NULL,
        item_id VARCHAR NOT NULL,
        downloaded_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ user_downloads table created');
    
    // Create indices for user_downloads
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_downloads_user ON user_downloads(user_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_downloads_item ON user_downloads(item_type, item_id);
    `);
    console.log('✅ user_downloads indices created');
    
    // Create user_ratings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_ratings (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        item_type VARCHAR NOT NULL,
        item_id VARCHAR NOT NULL,
        rating INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ user_ratings table created');
    
    // Create unique index for user_ratings (one rating per user per item)
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_user_ratings_unique ON user_ratings(user_id, item_type, item_id);
    `);
    console.log('✅ user_ratings unique index created');
    
    // Create content_reports table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS content_reports (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        reporter_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        item_type VARCHAR NOT NULL,
        item_id VARCHAR NOT NULL,
        reason VARCHAR NOT NULL,
        description TEXT,
        status VARCHAR DEFAULT 'pending',
        reviewed_by VARCHAR REFERENCES users(id),
        review_notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        reviewed_at TIMESTAMP
      );
    `);
    console.log('✅ content_reports table created');
    
    // Create indices for marketplace tables
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_marketplace_voices_author ON marketplace_voices(author_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_marketplace_voices_category ON marketplace_voices(category);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_marketplace_voices_active ON marketplace_voices(is_active, moderation_status);
    `);
    console.log('✅ marketplace_voices indices created');
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_marketplace_personalities_author ON marketplace_personalities(author_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_marketplace_personalities_category ON marketplace_personalities(category);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_marketplace_personalities_active ON marketplace_personalities(is_active, moderation_status);
    `);
    console.log('✅ marketplace_personalities indices created');
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_content_reports_status ON content_reports(status);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_content_reports_item ON content_reports(item_type, item_id);
    `);
    console.log('✅ content_reports indices created');
    
    console.log('🎉 Marketplace migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the migration
runMigration().catch(console.error);
