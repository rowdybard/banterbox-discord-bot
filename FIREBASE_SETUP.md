# Firebase Storage Setup Guide

This guide will help you set up Firebase Storage for BanterBox audio file storage.

## Why Firebase Storage?

- **Persistent**: Unlike Render's filesystem, Firebase Storage keeps your audio files permanently
- **Free Tier**: 5GB storage and 1GB/day downloads free
- **Fast**: Global CDN for quick audio delivery
- **Reliable**: Google's infrastructure

## Setup Steps

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or select existing project
3. Name it (e.g., "banterbox-audio")
4. Disable Google Analytics (not needed)

### 2. Enable Storage

1. In Firebase Console, click "Storage" in left sidebar
2. Click "Get started"
3. Choose "Start in production mode" (we'll make files public)
4. Select your region (choose closest to your users)
5. Click "Done"

### 3. Configure Storage Rules

1. Go to Storage → Rules tab
2. Replace the rules with:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /audio/{allPaths=**} {
      allow read: if true;  // Public read for audio files
      allow write: if false; // Only server can write
    }
  }
}
```
3. Click "Publish"

### 4. Get Service Account Key

1. Go to Project Settings (gear icon) → Service accounts
2. Click "Generate new private key"
3. Save the downloaded JSON file

### 5. Get Storage Bucket Name

1. Go to Storage in Firebase Console
2. Copy the bucket name (looks like: `your-project.appspot.com`)

## Environment Variables

Add these to your Render dashboard environment variables:

```bash
# Firebase Storage Configuration
FIREBASE_STORAGE_BUCKET=your-project.appspot.com

# Firebase Service Account Key (paste entire JSON as single line)
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"your-project","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}
```

### Important: Format the Service Account Key

The service account JSON must be on a single line. You can use this tool to convert it:
1. Copy your service account JSON
2. Go to [JSON Minifier](https://www.jsonformatter.org/json-minify)
3. Paste and minify
4. Copy the minified version
5. Paste as `FIREBASE_SERVICE_ACCOUNT_KEY` value

## Add to Render

1. Go to your [Render Dashboard](https://dashboard.render.com)
2. Select your BanterBox service
3. Go to Environment → Environment Variables
4. Add both variables above
5. Click "Save Changes"
6. Deploy will restart automatically

## Testing

After deployment:
1. Generate a banter in Discord
2. Check server logs for "Audio saved to Firebase Storage"
3. Audio URLs will look like: `https://storage.googleapis.com/your-bucket/audio/xxx.mp3`

## Troubleshooting

**"Firebase Storage not configured"**
- Check both environment variables are set correctly
- Service account key must be valid JSON (single line)

**"Permission denied" errors**
- Check Storage Rules are set to allow public read
- Verify service account has Storage Admin role

**Audio not playing**
- Check CORS settings in Firebase Storage
- Verify audio URLs are accessible in browser

## Benefits

✅ Audio files persist between deployments  
✅ No storage limits on Render  
✅ Fast global CDN delivery  
✅ Professional audio hosting  
✅ Automatic backups and redundancy