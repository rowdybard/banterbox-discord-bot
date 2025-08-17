#!/usr/bin/env node

import pkg from 'pg';
const { Client } = pkg;

async function addPasswordHashColumn() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Check if column already exists
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'password_hash'
    `);

    if (columnCheck.rows.length === 0) {
      console.log('Adding password_hash column...');
      await client.query(`
        ALTER TABLE users 
        ADD COLUMN password_hash VARCHAR
      `);
      console.log('✅ password_hash column added successfully');
    } else {
      console.log('✅ password_hash column already exists');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

addPasswordHashColumn();
