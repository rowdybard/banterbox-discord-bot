# 🚀 Render Environment Variables Setup

## 🔧 **Required Environment Variables**

Set these in your Render dashboard under **Environment Variables**:

### **Core Application (Required)**
```
NODE_ENV=production
PORT=10000
SESSION_SECRET=your-super-secure-32-character-random-string-here
DATABASE_URL=your-postgres-database-url-from-render
RENDER_EXTERNAL_HOSTNAME=your-app-name.onrender.com
```

### **Google OAuth (Required for Google Login)**
```
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
```

### **Discord Bot (Required for Discord Features)**
```
DISCORD_BOT_TOKEN=your-discord-bot-token
DISCORD_CLIENT_ID=your-discord-application-client-id
DISCORD_CLIENT_SECRET=your-discord-application-client-secret
```

### **Twitch Integration (Optional)**
```
TWITCH_CLIENT_ID=your-twitch-app-client-id
TWITCH_CLIENT_SECRET=your-twitch-app-client-secret
```

### **ElevenLabs TTS (Optional - Pro Feature)**
```
ELEVENLABS_API_KEY=your-elevenlabs-api-key
```

### **OpenAI (Required for Banter Generation)**
```
OPENAI_API_KEY=your-openai-api-key
```

### **Object Storage (Required for Audio Files)**
```
GOOGLE_CLOUD_PROJECT_ID=your-gcp-project-id
GOOGLE_CLOUD_BUCKET_NAME=your-gcs-bucket-name
GOOGLE_CLOUD_KEY_FILE=path-to-service-account-json
```

## 🔗 **How to Get These Values**

### **Google OAuth Setup**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `https://your-app-name.onrender.com/api/auth/google/callback`
6. Copy Client ID and Client Secret

### **Discord Bot Setup**
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create new application
3. Go to "Bot" section, create bot, copy token
4. Go to "OAuth2" section, copy Client ID and Client Secret
5. Add redirect URI: `https://your-app-name.onrender.com/api/auth/discord/callback`

### **Database URL**
- Render automatically provides this when you create a PostgreSQL database
- Format: `postgresql://username:password@host:port/database`

### **Session Secret**
- Generate a random 32+ character string
- You can use: `openssl rand -base64 32`

## ✅ **Authentication Fixes Applied**

1. **✅ Local Authentication**: Email/password registration and login
2. **✅ Google OAuth**: Social login with Google accounts  
3. **✅ User Management**: Proper user creation and session handling
4. **✅ Database Schema**: Added password field for local auth
5. **✅ Frontend Integration**: Fixed API endpoint mismatches

## 🔄 **Testing Authentication**

After setting environment variables:

1. **Local Registration**: 
   - Go to `/auth`
   - Click "Sign Up" tab
   - Fill form and submit
   - Should redirect to dashboard

2. **Local Login**:
   - Use registered email/password
   - Should authenticate successfully

3. **Google Login**:
   - Click "Google" button
   - Complete OAuth flow
   - Should create user and redirect to dashboard

## 🚨 **Important Notes**

- **Database**: Must be PostgreSQL (Render provides this)
- **Sessions**: Stored in PostgreSQL using `connect-pg-simple`
- **Security**: All passwords are bcrypt hashed
- **Domains**: Make sure to update OAuth redirect URIs when your domain changes
- **HTTPS**: All OAuth providers require HTTPS (Render provides this automatically)

## 🔍 **Debugging Tips**

If authentication isn't working:

1. **Check Logs**: Look at Render deployment logs for errors
2. **Environment Variables**: Verify all required vars are set
3. **OAuth Domains**: Ensure redirect URIs match exactly
4. **Database**: Confirm PostgreSQL connection is working
5. **Session Secret**: Must be set for sessions to work

Your authentication should now work perfectly on Render! 🎉
