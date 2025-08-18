// build-server.js
import esbuild from 'esbuild';
import { resolve } from 'node:path';
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔨 Building server...');

// Run the database migration first
console.log('🔄 Running database migration...');
try {
  execSync('node migrate-db.js', { stdio: 'inherit' });
  console.log('✅ Database migration completed');
} catch (error) {
  console.log('⚠️ Database migration failed (this is normal if columns already exist):', error.message);
}

// Build the client
console.log('🏗️ Building client...');
execSync('npm run build', { stdio: 'inherit' });

// Build the server
console.log('⚙️ Building server...');
execSync('npx esbuild server/index.ts --bundle --platform=node --target=node18 --outfile=dist/server.js --external:pg-native', { stdio: 'inherit' });

console.log('✅ Build completed!');
