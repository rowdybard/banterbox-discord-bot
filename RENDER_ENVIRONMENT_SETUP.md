# 🚀 Render Environment Variables Setup Guide

## 🔧 **Required Environment Variables for Render**

Set these in your Render dashboard under **Environment Variables**:

### **Core Application (Required)**
```
NODE_ENV=production
PORT=10000
SESSION_SECRET=your-super-secure-32-character-random-string-here
```

### **Firebase Configuration (Required)**
```
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"your-project-id","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
```

### **Discord Bot (Required for Discord functionality)**
```
DISCORD_APPLICATION_ID=your_discord_application_id
DISCORD_BOT_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_PUBLIC_KEY=your_discord_public_key
```

### **AI Services (Required for banter generation)**
```
OPENAI_API_KEY=your_openai_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
```

### **Optional: Google OAuth**
```
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### **Optional: Twitch Integration**
```
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
```

## 🔑 **How to Get These Values**

### **Firebase Setup**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to Project Settings → Service Accounts
4. Click "Generate new private key"
5. Download the JSON file
6. **IMPORTANT**: Convert the JSON to a single line:
   - Copy the entire JSON content
   - Go to [JSON Minifier](https://www.jsonformatter.org/json-minify)
   - Paste and minify
   - Copy the minified version (single line)
   - Paste as `FIREBASE_SERVICE_ACCOUNT_KEY` value

### **Discord Bot Setup**
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application or select existing
3. Go to "Bot" section
4. Copy the bot token
5. Go to "General Information" section
6. Copy the Application ID, Client ID, and Client Secret
7. Go to "Bot" section and copy the Public Key

### **OpenAI Setup**
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create a new API key
3. Copy the key

### **ElevenLabs Setup (Optional)**
1. Go to [ElevenLabs](https://elevenlabs.io/)
2. Sign up and get your API key
3. Copy the key

## 🚨 **Common Issues & Solutions**

### **"Unexpected token 'y', 'your-servi'... is not valid JSON"**
- **Problem**: Firebase service account key is not valid JSON
- **Solution**: 
  1. Download fresh service account JSON from Firebase Console
  2. Use JSON minifier to convert to single line
  3. Make sure there are no extra quotes or characters

### **"Firebase Storage not configured"**
- **Problem**: Missing Firebase environment variables
- **Solution**: Set both `FIREBASE_SERVICE_ACCOUNT_KEY` and `FIREBASE_STORAGE_BUCKET`

### **"Missing Discord bot credentials"**
- **Problem**: Discord environment variables not set
- **Solution**: Set all Discord-related environment variables

### **"No guild settings found"**
- **Problem**: Missing Firebase Firestore indexes
- **Solution**: Create required indexes in Firebase Console

## 📋 **Step-by-Step Render Setup**

1. **Go to Render Dashboard**
   - Visit [dashboard.render.com](https://dashboard.render.com)
   - Select your BanterBox service

2. **Navigate to Environment Variables**
   - Click on your service
   - Go to "Environment" tab
   - Click "Environment Variables"

3. **Add Variables One by One**
   - Click "Add Environment Variable"
   - Add each variable from the list above
   - **Important**: For `FIREBASE_SERVICE_ACCOUNT_KEY`, paste the minified JSON as a single line

4. **Save and Deploy**
   - Click "Save Changes"
   - Render will automatically redeploy

5. **Check Logs**
   - Go to "Logs" tab to see deployment progress
   - Look for any error messages

## 🔍 **Verification Steps**

After setting environment variables:

1. **Check Firebase Connection**
   - Look for "Firebase Admin initialized successfully" in logs
   - No "Firebase Storage not configured" errors

2. **Check Discord Bot**
   - Look for "Discord bot initialized successfully" in logs
   - No "Missing Discord bot credentials" errors

3. **Test Discord Commands**
   - Try `/status` command in your Discord server
   - Should respond with bot status

4. **Test Firebase Operations**
   - Try linking a server with `/link` command
   - Should create guild settings in Firebase

## 🆘 **Still Having Issues?**

1. **Check Render Logs** for specific error messages
2. **Verify JSON Format** of Firebase service account key
3. **Test Firebase Connection** with diagnostic script
4. **Check Discord Bot Permissions** and invite URL
5. **Verify All Environment Variables** are set correctly

## 📞 **Need Help?**

If you're still having issues:
1. Check the logs in your Render dashboard
2. Verify all environment variables are set correctly
3. Make sure Firebase service account key is valid JSON
4. Ensure Discord bot has proper permissions
