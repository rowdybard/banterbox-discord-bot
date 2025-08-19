// Test script to verify Firebase environment variables
console.log('=== Firebase Environment Variables Test ===\n');

// Check if Firebase environment variables are set
const hasServiceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
const hasStorageBucket = process.env.FIREBASE_STORAGE_BUCKET;

console.log('Environment Variables Status:');
console.log('- FIREBASE_SERVICE_ACCOUNT_KEY:', hasServiceAccountKey ? 'SET' : 'NOT_SET');
console.log('- FIREBASE_STORAGE_BUCKET:', hasStorageBucket ? `SET (${process.env.FIREBASE_STORAGE_BUCKET})` : 'NOT_SET');

if (!hasServiceAccountKey || !hasStorageBucket) {
  console.log('\n❌ Missing Firebase environment variables!');
  console.log('Please set both FIREBASE_SERVICE_ACCOUNT_KEY and FIREBASE_STORAGE_BUCKET in your Render dashboard.');
  process.exit(1);
}

// Test if service account key is valid JSON
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  console.log('\n✅ FIREBASE_SERVICE_ACCOUNT_KEY is valid JSON');
  console.log('- Project ID:', serviceAccount.project_id);
  console.log('- Client Email:', serviceAccount.client_email);
} catch (error) {
  console.log('\n❌ FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON!');
  console.log('Error:', error.message);
  console.log('\nTo fix this:');
  console.log('1. Download fresh service account JSON from Firebase Console');
  console.log('2. Use JSON minifier to convert to single line');
  console.log('3. Make sure there are no extra quotes or characters');
  process.exit(1);
}

console.log('\n✅ Firebase environment variables are set correctly!');
console.log('You can now deploy to Render with these variables.');
