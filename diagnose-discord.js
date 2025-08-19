// Diagnostic script for Discord bot and Firebase issues
console.log('=== Discord Bot & Firebase Diagnostic ===\n');

// Check environment variables
console.log('Environment Variables Status:');
console.log('- FIREBASE_SERVICE_ACCOUNT_KEY:', process.env.FIREBASE_SERVICE_ACCOUNT_KEY ? 'SET' : 'NOT_SET');
console.log('- FIREBASE_STORAGE_BUCKET:', process.env.FIREBASE_STORAGE_BUCKET ? `SET (${process.env.FIREBASE_STORAGE_BUCKET})` : 'NOT_SET');
console.log('- DISCORD_BOT_TOKEN:', process.env.DISCORD_BOT_TOKEN ? 'SET' : 'NOT_SET');
console.log('- DISCORD_APPLICATION_ID:', process.env.DISCORD_APPLICATION_ID ? 'SET' : 'NOT_SET');
console.log('- OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'SET' : 'NOT_SET');

console.log('\n=== Common Issues & Solutions ===\n');

// Issue 1: Missing Firebase credentials
if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY || !process.env.FIREBASE_STORAGE_BUCKET) {
  console.log('❌ ISSUE 1: Missing Firebase credentials');
  console.log('   SOLUTION: Set your Firebase environment variables');
  console.log('   - FIREBASE_SERVICE_ACCOUNT_KEY: Your service account JSON');
  console.log('   - FIREBASE_STORAGE_BUCKET: Your bucket name (e.g., project-id.appspot.com)');
  console.log('');
}

// Issue 2: Missing Discord credentials
if (!process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_APPLICATION_ID) {
  console.log('❌ ISSUE 2: Missing Discord bot credentials');
  console.log('   SOLUTION: Set your Discord bot environment variables');
  console.log('   - DISCORD_BOT_TOKEN: Your bot token from Discord Developer Portal');
  console.log('   - DISCORD_APPLICATION_ID: Your application ID from Discord Developer Portal');
  console.log('');
}

// Issue 3: Missing OpenAI key
if (!process.env.OPENAI_API_KEY) {
  console.log('❌ ISSUE 3: Missing OpenAI API key');
  console.log('   SOLUTION: Set your OpenAI API key');
  console.log('   - OPENAI_API_KEY: Your OpenAI API key');
  console.log('');
}

console.log('=== Firebase Indexes Required ===\n');
console.log('You need these indexes in Firebase Console > Firestore Database > Indexes:');
console.log('');
console.log('Collection: guildSettings');
console.log('- Field: guildId (Ascending)');
console.log('');
console.log('Collection: guildLinks');
console.log('- Field: active (Ascending)');
console.log('- Field: workspaceId (Ascending)');
console.log('');
console.log('Collection: users');
console.log('- Field: email (Ascending)');
console.log('');
console.log('Collection: userSettings');
console.log('- Field: userId (Ascending)');
console.log('');

console.log('=== Discord Bot Setup Checklist ===\n');
console.log('1. ✅ Bot created in Discord Developer Portal');
console.log('2. ✅ Bot token copied to environment variables');
console.log('3. ✅ Bot invited to your server with proper permissions');
console.log('4. ✅ Slash commands registered');
console.log('5. ✅ Firebase credentials set');
console.log('6. ✅ Firebase indexes created');
console.log('7. ✅ Server linked with /link command');
console.log('');

console.log('=== Next Steps ===\n');
console.log('1. Set your environment variables');
console.log('2. Create Firebase indexes');
console.log('3. Restart your server');
console.log('4. Run /link command in Discord');
console.log('5. Check /status command in Discord');
console.log('');

console.log('=== Test Commands ===\n');
console.log('In your Discord server, try these commands:');
console.log('- /status - Check if server is linked');
console.log('- /link <code> - Link server to workspace');
console.log('- /unlink - Unlink server');
console.log('- /config - Configure settings');
console.log('');
