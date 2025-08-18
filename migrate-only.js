// Simple migration script that can be run independently
const { execSync } = require('child_process');

console.log('🔄 Running database migration...');

try {
  execSync('node migrate-db.js', { stdio: 'inherit' });
  console.log('✅ Database migration completed successfully!');
} catch (error) {
  console.log('❌ Database migration failed:', error.message);
  console.log('This might be due to missing DATABASE_URL environment variable');
  process.exit(1);
}
