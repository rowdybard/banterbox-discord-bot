# Firebase Setup Guide

This guide will help you set up Firebase for your BanterBox application after migrating from PostgreSQL.

## Prerequisites

1. A Google Cloud Project
2. Firebase project created
3. Firebase Admin SDK service account key

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or select an existing project
3. Follow the setup wizard
4. Enable Firestore Database

## Step 2: Set up Firestore Database

1. In Firebase Console, go to "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode" (you can secure it later)
4. Select a location close to your users
5. Click "Done"

## Step 3: Get Service Account Key

1. In Firebase Console, go to Project Settings (gear icon)
2. Go to "Service accounts" tab
3. Click "Generate new private key"
4. Download the JSON file
5. **Keep this file secure - never commit it to version control**

## Step 4: Set Environment Variables

Add these environment variables to your `.env` file:

```bash
# Firebase Configuration
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"your-project-id",...}
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com

# Optional: Google Cloud Storage (if using Firebase Storage)
GCS_BUCKET=your-project-id.appspot.com

# Remove PostgreSQL URL (optional - keep for migration purposes)
# DATABASE_URL=postgresql://...
```

## Step 5: Install Dependencies

```bash
npm install
```

## Step 6: Test Firebase Connection

Start your application:

```bash
npm run dev
```

You should see:
- `✅ Firebase Admin storage and Firestore initialized`
- `ℹ️  No DATABASE_URL provided - using Firebase Firestore`

## Step 7: Firestore Security Rules

Update your Firestore security rules in the Firebase Console:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /userSettings/{docId} {
      allow read, write: if request.auth != null && 
        resource.data.userId == request.auth.uid;
    }
    
    match /banterItems/{docId} {
      allow read, write: if request.auth != null && 
        resource.data.userId == request.auth.uid;
    }
    
    // Allow public read access to marketplace items
    match /marketplaceVoices/{docId} {
      allow read: if true;
      allow write: if request.auth != null && 
        resource.data.authorId == request.auth.uid;
    }
    
    match /marketplacePersonalities/{docId} {
      allow read: if true;
      allow write: if request.auth != null && 
        resource.data.authorId == request.auth.uid;
    }
    
    // Allow authenticated users to manage their downloads and ratings
    match /userDownloads/{docId} {
      allow read, write: if request.auth != null && 
        resource.data.userId == request.auth.uid;
    }
    
    match /userRatings/{docId} {
      allow read, write: if request.auth != null && 
        resource.data.userId == request.auth.uid;
    }
  }
}
```

## Step 8: Data Migration (Optional)

If you have existing PostgreSQL data, you can migrate it:

1. Export your PostgreSQL data
2. Use the Firebase Admin SDK to import data
3. Create a migration script if needed

## Step 9: Verify Everything Works

Test these features:
- [ ] User registration and login
- [ ] User settings management
- [ ] Banter creation and retrieval
- [ ] Twitch/Discord integration
- [ ] Marketplace functionality
- [ ] File uploads (if using Firebase Storage)

## Troubleshooting

### Firebase not initializing
- Check that `FIREBASE_SERVICE_ACCOUNT_KEY` is properly set
- Verify the service account key JSON is valid
- Ensure the Firebase project exists

### Permission denied errors
- Check Firestore security rules
- Verify the service account has proper permissions
- Check if you're in the correct Firebase project

### Authentication issues
- Ensure session configuration is correct
- Check that user data is being stored properly
- Verify passport strategies are configured

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Firebase Admin SDK service account JSON | Yes |
| `FIREBASE_STORAGE_BUCKET` | Firebase Storage bucket name | Yes |
| `GCS_BUCKET` | Google Cloud Storage bucket (fallback) | No |
| `SESSION_SECRET` | Session encryption secret | Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | No |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | No |
| `DISCORD_CLIENT_ID` | Discord OAuth client ID | No |
| `DISCORD_CLIENT_SECRET` | Discord OAuth client secret | No |
| `TWITCH_CLIENT_ID` | Twitch OAuth client ID | No |
| `TWITCH_CLIENT_SECRET` | Twitch OAuth client secret | No |

## Next Steps

1. Set up Firebase Authentication (optional)
2. Configure Firebase Storage for file uploads
3. Set up Firebase Functions for serverless operations
4. Configure Firebase Hosting for static assets
5. Set up monitoring and analytics

## Support

If you encounter issues:
1. Check the Firebase Console for errors
2. Review the application logs
3. Verify environment variables
4. Test with a simple Firebase connection first