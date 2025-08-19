// Test Firebase queries to identify missing indexes
const admin = require('firebase-admin');

// Initialize Firebase Admin
function initializeFirebase() {
  try {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

    if (!serviceAccountKey || !storageBucket) {
      console.log('❌ Firebase environment variables not set');
      return null;
    }

    const serviceAccount = JSON.parse(serviceAccountKey);
    
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket,
      });
    }

    console.log('✅ Firebase Admin initialized');
    return admin.firestore();
  } catch (error) {
    console.error('❌ Failed to initialize Firebase:', error);
    return null;
  }
}

// Test queries that commonly need indexes
async function testQueries() {
  const db = initializeFirebase();
  if (!db) return;

  console.log('\n=== Testing Firebase Queries ===\n');

  const tests = [
    {
      name: 'Get user by email',
      query: () => db.collection('users').where('email', '==', 'test@example.com').get()
    },
    {
      name: 'Get user settings',
      query: () => db.collection('userSettings').where('userId', '==', 'test-user').get()
    },
    {
      name: 'Get banter items by user',
      query: () => db.collection('banterItems').where('userId', '==', 'test-user').get()
    },
    {
      name: 'Get banter items by user and event type',
      query: () => db.collection('banterItems').where('userId', '==', 'test-user').where('eventType', '==', 'chat').get()
    },
    {
      name: 'Get link codes',
      query: () => db.collection('linkCodes').where('code', '==', 'test-code').where('consumedAt', '==', null).get()
    },
    {
      name: 'Get active guild links',
      query: () => db.collection('guildLinks').where('active', '==', true).get()
    },
    {
      name: 'Get user API keys',
      query: () => db.collection('userApiKeys').where('userId', '==', 'test-user').where('isActive', '==', true).get()
    },
    {
      name: 'Get usage tracking',
      query: () => db.collection('usageTracking').where('userId', '==', 'test-user').where('date', '==', '2024-01-01').get()
    },
    {
      name: 'Get marketplace voices',
      query: () => db.collection('marketplaceVoices').where('isActive', '==', true).where('moderationStatus', '==', 'approved').get()
    },
    {
      name: 'Get marketplace personalities',
      query: () => db.collection('marketplacePersonalities').where('isActive', '==', true).where('moderationStatus', '==', 'approved').get()
    },
    {
      name: 'Get user downloads',
      query: () => db.collection('userDownloads').where('userId', '==', 'test-user').where('itemType', '==', 'voice').where('itemId', '==', 'test-id').get()
    },
    {
      name: 'Get content reports',
      query: () => db.collection('contentReports').where('moderationStatus', '==', 'pending').get()
    },
    {
      name: 'Get guild links by workspace',
      query: () => db.collection('guildLinks').where('workspaceId', '==', 'test-workspace').get()
    }
  ];

  for (const test of tests) {
    try {
      console.log(`Testing: ${test.name}`);
      await test.query();
      console.log(`✅ ${test.name} - Query successful`);
    } catch (error) {
      if (error.code === 'failed-precondition' || error.message.includes('index')) {
        console.log(`❌ ${test.name} - Missing index required`);
        console.log(`   Error: ${error.message}`);
      } else {
        console.log(`⚠️  ${test.name} - Other error: ${error.message}`);
      }
    }
    console.log('');
  }

  console.log('=== Test Complete ===');
  console.log('\nIf you see "Missing index required" errors, you need to create the indexes listed in firebase-indexes.md');
}

// Run the tests
testQueries().catch(console.error);
