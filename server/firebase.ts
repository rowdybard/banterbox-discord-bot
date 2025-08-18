// server/firebase.ts
import admin from 'firebase-admin';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { Storage } from '@google-cloud/storage';

// Plain Google Cloud Storage client (fallback if Firebase Admin isn't configured)
const gcs = new Storage();
const fallbackBucketName = process.env.GCS_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || '';

// Single exported bucket reference for non-Admin callers
// Typed as `any` to avoid CJS/ESM d.ts mismatches across @google-cloud/storage builds
export const bucket: any = fallbackBucketName ? gcs.bucket(fallbackBucketName) : null;

// Firebase Admin state (kept separate to avoid name collisions with the exported `bucket`)
let firebaseApp: admin.app.App | null = null;
let adminBucket: any = null;
let firestoreDb: any = null;

export function initializeFirebase(): any | null {
  // Reuse if already initialized
  if (firebaseApp) return adminBucket;

  try {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

    if (!serviceAccountKey || !storageBucket) {
      console.log('Firebase Storage not configured — using GCS fallback only');
      return null;
    }

    const serviceAccount = JSON.parse(serviceAccountKey);

    firebaseApp = admin.apps.length
      ? admin.app()
      : admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          storageBucket,
        });

    adminBucket = getStorage(firebaseApp).bucket();
    firestoreDb = getFirestore(firebaseApp);
    console.log('✅ Firebase Admin storage and Firestore initialized');
    return adminBucket;
  } catch (err) {
    console.error('Failed to initialize Firebase Admin:', err);
    return null;
  }
}

export class FirebaseStorageService {
  private bucket: any;

  constructor() {
    // Prefer Admin bucket when available (signed URLs/uniform access), else plain GCS
    this.bucket = initializeFirebase() || bucket;
  }

  isAvailable(): boolean {
    return !!this.bucket;
  }

  async saveAudioFile(audioBuffer: Buffer): Promise<string | null> {
    if (!this.bucket) {
      console.log('No storage bucket available');
      return null;
    }

    try {
      const audioId = randomUUID();
      const fileName = `audio/${audioId}.mp3`;
      const file = this.bucket.file(fileName);

      await file.save(audioBuffer, {
        metadata: {
          contentType: 'audio/mpeg',
          cacheControl: 'public, max-age=3600',
        },
        public: true, // Make the file publicly accessible
      });

      const publicUrl = this.bucket?.name
        ? `https://storage.googleapis.com/${this.bucket.name}/${fileName}`
        : null;

      if (publicUrl) console.log(`Audio saved to storage: ${publicUrl}`);
      return publicUrl;
    } catch (error) {
      console.error('Error saving to storage:', error);
      return null;
    }
  }

  async deleteAudioFile(url: string): Promise<boolean> {
    if (!this.bucket || !url?.includes('storage.googleapis.com')) return false;

    try {
      // Extract file path from URL
      const match = url.match(/storage\.googleapis\.com\/[^/]+\/(.*)/);
      if (!match) return false;

      const filePath = match[1];
      await this.bucket.file(filePath).delete();
      console.log(`Deleted audio file from storage: ${filePath}`);
      return true;
    } catch (error) {
      console.error('Error deleting from storage:', error);
      return false;
    }
  }
}

// Export a singleton instance for convenience
export const firebaseStorage = new FirebaseStorageService();

// Export Firestore instance
export function getFirestoreDb() {
  if (!firestoreDb) {
    initializeFirebase();
  }
  return firestoreDb;
}
