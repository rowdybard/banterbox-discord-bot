const { execSync } = require('child_process');

console.log('🚀 Starting BanterBox...');

// Run database migration first
console.log('🔄 Running database migration...');
try {
  execSync('node migrate-db.js', { stdio: 'inherit' });
  console.log('✅ Database migration completed');
} catch (error) {
  console.log('⚠️ Database migration failed (this is normal if columns already exist):', error.message);
}

// Start the server
console.log('🌐 Starting server...');
execSync('node dist/server.js', { stdio: 'inherit' });