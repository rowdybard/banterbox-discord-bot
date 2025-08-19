// Test guild settings functionality
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

// Test guild settings operations
async function testGuildSettings() {
  const db = initializeFirebase();
  if (!db) return;

  console.log('\n=== Testing Guild Settings ===\n');

  const testGuildId = 'test-guild-123';
  const testWorkspaceId = 'test-workspace-456';

  try {
    // Test 1: Create guild settings
    console.log('1. Creating guild settings...');
    const guildSettings = {
      guildId: testGuildId,
      workspaceId: testWorkspaceId,
      enabledEvents: ['discord_message', 'discord_member_join', 'discord_reaction'],
      voiceProvider: 'openai',
      personality: 'witty',
      updatedAt: new Date(),
    };

    await db.collection('guildSettings').doc(testGuildId).set(guildSettings, { merge: true });
    console.log('✅ Guild settings created successfully');

    // Test 2: Retrieve guild settings
    console.log('\n2. Retrieving guild settings...');
    const doc = await db.collection('guildSettings').doc(testGuildId).get();
    
    if (doc.exists) {
      console.log('✅ Guild settings retrieved successfully');
      console.log('Data:', doc.data());
    } else {
      console.log('❌ Guild settings not found');
    }

    // Test 3: Check if collection exists
    console.log('\n3. Checking guildSettings collection...');
    const snapshot = await db.collection('guildSettings').limit(1).get();
    console.log(`✅ guildSettings collection exists with ${snapshot.size} documents`);

    // Test 4: List all guild settings
    console.log('\n4. Listing all guild settings...');
    const allSettings = await db.collection('guildSettings').get();
    console.log(`Found ${allSettings.size} guild settings documents:`);
    
    allSettings.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`  ${index + 1}. Guild ID: ${data.guildId}, Workspace: ${data.workspaceId}`);
    });

    // Test 5: Clean up test data
    console.log('\n5. Cleaning up test data...');
    await db.collection('guildSettings').doc(testGuildId).delete();
    console.log('✅ Test data cleaned up');

  } catch (error) {
    console.error('❌ Error testing guild settings:', error);
    
    if (error.code === 'failed-precondition') {
      console.log('💡 This might be a missing index error. Check Firebase Console > Firestore Database > Indexes');
    }
  }

  console.log('\n=== Test Complete ===');
}

// Run the tests
testGuildSettings().catch(console.error);
