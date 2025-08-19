// Test Firebase environment variables
console.log('=== Firebase Environment Variables Test ===');

const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

console.log('FIREBASE_SERVICE_ACCOUNT_KEY:', serviceAccountKey ? 'SET' : 'NOT_SET');
console.log('FIREBASE_STORAGE_BUCKET:', storageBucket ? `SET (${storageBucket})` : 'NOT_SET');

if (serviceAccountKey) {
  try {
    const parsed = JSON.parse(serviceAccountKey);
    console.log('✅ Service account key parsed successfully');
    console.log('Project ID:', parsed.project_id);
    console.log('Client Email:', parsed.client_email);
  } catch (error) {
    console.log('❌ Error parsing service account key:', error.message);
  }
} else {
  console.log('❌ FIREBASE_SERVICE_ACCOUNT_KEY not set');
}

if (!storageBucket) {
  console.log('❌ FIREBASE_STORAGE_BUCKET not set');
}

console.log('=== End Test ===');
