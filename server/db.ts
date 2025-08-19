import { getFirestoreDb } from './firebase';

// Firebase database setup
let db: any = null;

try {
  db = getFirestoreDb();
  console.log('✅ Firebase database initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Firebase database:', error);
  db = null;
}

export { db };

// For backward compatibility, export a dummy pool
export const pool = null;