# 🚀 Render Deployment Guide for BanterBox Discord Bot

## ✅ **What's Fixed**

This guide addresses the main issues that broke when moving from Replit to Render:

1. **Authentication System** - Replaced Replit OAuth with local authentication
2. **Environment Variables** - Updated to use Render-specific variables
3. **Domain References** - Fixed all Replit domain references to use Render domains
4. **Database Schema** - Added password field for local authentication
5. **Session Management** - Updated to work with Render's PostgreSQL

## 🔧 **Required Environment Variables**

Set these in your Render dashboard under **Environment Variables**:

### **Core Variables (Required)**
```env
NODE_ENV=production
PORT=10000
SESSION_SECRET=your-32-character-random-session-secret-here
DATABASE_URL=[auto-provided by Render PostgreSQL]
```

### **Discord Bot (Required for Discord functionality)**
```env
DISCORD_APPLICATION_ID=your_discord_application_id
DISCORD_BOT_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_PUBLIC_KEY=your_discord_public_key
```

### **AI Services (Required for banter generation)**
```env
OPENAI_API_KEY=your_openai_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
```

### **Optional: Google OAuth**
```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### **Optional: Twitch Integration**
```env
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
```

### **Optional: File Storage (for audio files)**
```env
# Google Cloud Storage
GCS_BUCKET=your_gcs_bucket_name
GOOGLE_APPLICATION_CREDENTIALS=your_service_account_key_json

# OR Firebase Storage
FIREBASE_STORAGE_BUCKET=your_firebase_bucket_name
FIREBASE_SERVICE_ACCOUNT_KEY=your_service_account_key_json
```

## 🗄️ **Database Setup**

1. **Create PostgreSQL Database** in Render dashboard
2. **DATABASE_URL** will be automatically provided
3. **Run migrations** after first deployment:
   ```bash
   npm run db:push
   ```

## 🔐 **Generate Session Secret**

Generate a secure session secret:

```bash
# Option 1: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 2: Online generator
# Go to https://www.allkeysgenerator.com/Random/Security-Encryption-Key-Generator.aspx
```

## 📝 **Render Configuration**

Your `render.yaml` should look like this:

```yaml
services:
  - type: web
    name: banterbox-discord-bot
    env: node
    region: oregon
    plan: free
    buildCommand: npm ci && npm run build
    startCommand: npm start
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
```

## 🔄 **Deployment Steps**

1. **Push your code** to GitHub
2. **Connect repository** to Render
3. **Set environment variables** in Render dashboard
4. **Deploy** - Render will automatically build and deploy
5. **Run database migration**:
   ```bash
   npm run db:push
   ```

## 🧪 **Testing After Deployment**

1. **Health Check**: Visit `https://your-app.onrender.com/api/health`
2. **Authentication**: Test local login/register
3. **Discord Bot**: Check if bot responds to commands
4. **WebSocket**: Test real-time features

## 🚨 **Common Issues & Solutions**

### **Error: "Cannot read properties of undefined"**
- ✅ Check all required environment variables are set
- ✅ Ensure DATABASE_URL is working

### **Error: "redirect_uri_mismatch" (Google OAuth)**
- ✅ Add your Render URL to Google Cloud Console
- ✅ Format: `https://your-app.onrender.com/api/auth/google/callback`

### **Error: "Session not persisting"**
- ✅ Set SESSION_SECRET environment variable
- ✅ Ensure DATABASE_URL is connected
- ✅ Check sessions table exists

### **Error: "Discord bot not responding"**
- ✅ Verify all Discord environment variables are set
- ✅ Check bot has proper permissions
- ✅ Ensure bot is invited to server

### **Error: "Database connection failed"**
- ✅ Verify DATABASE_URL is correct
- ✅ Run `npm run db:push` to create tables
- ✅ Check PostgreSQL database is running

## 🔍 **Debug Commands**

Check these in your Render console:

```bash
# Check environment variables
echo $NODE_ENV
echo $DATABASE_URL
echo $SESSION_SECRET

# Test database connection
npm run db:push

# Check logs
# (Available in Render dashboard)
```

## 📊 **Monitoring**

- **Logs**: Available in Render dashboard
- **Health**: `/api/health` endpoint
- **Database**: PostgreSQL dashboard in Render
- **Performance**: Render's built-in monitoring

## 🎯 **Success Checklist**

- [ ] All environment variables set
- [ ] Database connected and migrated
- [ ] Health check endpoint working
- [ ] Local authentication working
- [ ] Discord bot responding
- [ ] WebSocket connections working
- [ ] Audio generation working (if configured)
- [ ] File storage working (if configured)

## 🆘 **Still Having Issues?**

1. **Check Render Logs** for specific error messages
2. **Verify Environment Variables** are all set correctly
3. **Test Database Connection** with `npm run db:push`
4. **Check Discord Bot Permissions** and invite URL
5. **Verify Google OAuth** redirect URIs if using Google login

**Most issues are caused by missing environment variables or incorrect OAuth redirect URIs.**
