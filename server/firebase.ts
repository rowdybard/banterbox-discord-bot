import admin from 'firebase-admin';
import { getStorage } from 'firebase-admin/storage';
import { randomUUID } from 'crypto';
import type { Bucket } from '@google-cloud/storage';
import { Storage } from '@google-cloud/storage';
const storage = new Storage();
// Initialize Firebase Admin SDK
let firebaseApp: admin.app.App | null = null;
let bucket: Bucket | null = null;
export const bucket: any = storage.bucket(process.env.GCS_BUCKET!);
export function initializeFirebase() {
  // Check if Firebase is already initialized
  if (firebaseApp) {
    return bucket;
  }

  try {
    // Use service account key from environment variable
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

    if (!serviceAccountKey || !storageBucket) {
      console.log('Firebase Storage not configured - audio will use fallback storage');
      return null;
    }

    // Parse the service account key
    const serviceAccount = JSON.parse(serviceAccountKey);

    // Initialize Firebase Admin
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: storageBucket
    });

    // Get storage bucket
    bucket = getStorage(firebaseApp).bucket();

    console.log('✅ Firebase Storage initialized successfully');
    return bucket;
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    return null;
  }
}

export class FirebaseStorageService {
  private bucket: Bucket | null;

  constructor() {
    this.bucket = initializeFirebase();
  }

  async saveAudioFile(audioBuffer: Buffer): Promise<string | null> {
    if (!this.bucket) {
      console.log('Firebase Storage not available, using fallback');
      return null;
    }

    try {
      const audioId = randomUUID();
      const fileName = `audio/${audioId}.mp3`;
      
      // Create a file reference
      const file = this.bucket.file(fileName);

      // Upload the buffer
      await file.save(audioBuffer, {
        metadata: {
          contentType: 'audio/mpeg',
          cacheControl: 'public, max-age=3600',
        },
        public: true, // Make the file publicly accessible
      });

      // Get the public URL
      const publicUrl = `https://storage.googleapis.com/${this.bucket.name}/${fileName}`;
      
      console.log(`Audio saved to Firebase Storage: ${publicUrl}`);
      return publicUrl;
    } catch (error) {
      console.error('Error saving to Firebase Storage:', error);
      return null;
    }
  }

  async deleteAudioFile(url: string): Promise<boolean> {
    if (!this.bucket || !url.includes('storage.googleapis.com')) {
      return false;
    }

    try {
      // Extract file path from URL
      const match = url.match(/storage\.googleapis\.com\/[^\/]+\/(.*)/);
      if (!match) return false;
      
      const filePath = match[1];
      const file = this.bucket.file(filePath);
      
      await file.delete();
      console.log(`Deleted audio file from Firebase: ${filePath}`);
      return true;
    } catch (error) {
      console.error('Error deleting from Firebase Storage:', error);
      return false;
    }
  }

  isAvailable(): boolean {
    return this.bucket !== null;
  }
}

// Export a singleton instance
export const firebaseStorage = new FirebaseStorageService();
