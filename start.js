// Render deployment entry point
const path = require('path');

// Set NODE_ENV to production if not set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

// Import and run the main server file
require('./dist/index.js');