# 🔧 Fixing Authentication Issues on Render

## ❌ **Common Authentication Errors**
- "Error 400: redirect_uri_mismatch" (Google OAuth)
- "Error 500: Internal Server Error" (Missing environment variables)
- "Unauthorized" or blank pages after login
- Session not persisting after login

## ✅ **Step-by-Step Fix**

### **1. Update Google Cloud Console**

Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials):

1. **Find your OAuth 2.0 Client ID**
2. **Add Authorized Redirect URIs:**
   ```
   https://your-app-name.onrender.com/api/auth/google/callback
   ```
   Replace `your-app-name` with your actual Render app name

3. **Save the changes**

### **2. Set Required Environment Variables on Render**

In your Render dashboard, add these environment variables:

#### **Required for Authentication:**
```env
NODE_ENV=production
PORT=10000
SESSION_SECRET=your-random-32-character-secret
DATABASE_URL=[auto-provided by Render]
```

#### **For Google OAuth (Optional but Recommended):**
```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

#### **For Discord Bot:**
```env
DISCORD_APPLICATION_ID=your_discord_app_id
DISCORD_BOT_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_PUBLIC_KEY=your_discord_public_key
```

#### **For AI Features:**
```env
OPENAI_API_KEY=your_openai_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
```

### **3. Generate a Strong Session Secret**

Generate a random 32+ character session secret:

```bash
# Option 1: Use online generator
# Go to https://www.allkeysgenerator.com/Random/Security-Encryption-Key-Generator.aspx

# Option 2: Use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 3: Use OpenSSL
openssl rand -hex 32
```

### **4. Database Setup**

Ensure your Render PostgreSQL database is properly connected:

1. **Check DATABASE_URL** is automatically set by Render
2. **Run database migration** after deployment:
   ```bash
   npm run db:push
   ```

### **5. Test Authentication Flow**

After fixing the above:

1. **Deploy your updated code** to Render
2. **Visit your app**: `https://your-app-name.onrender.com`
3. **Test Local Login**: Click "Sign In" → Should go to `/auth` page
4. **Test Google Login**: Click "Google" → Should redirect to Google
5. **Check Console Logs** in Render dashboard for any errors

## 🚨 **Troubleshooting Specific Errors**

### **Error: "redirect_uri_mismatch"**
- ✅ Fix: Add your Render URL to Google Cloud Console Authorized Redirect URIs
- ✅ Format: `https://your-app-name.onrender.com/api/auth/google/callback`

### **Error: "Internal Server Error"**
- ✅ Check Render logs for specific error messages
- ✅ Ensure all required environment variables are set
- ✅ Verify DATABASE_URL is working

### **Error: Session not persisting**
- ✅ Set `SESSION_SECRET` environment variable
- ✅ Ensure DATABASE_URL is connected
- ✅ Check that `sessions` table exists in database

### **Error: "Cannot read properties of undefined"**
- ✅ Missing environment variables
- ✅ Check all required vars are set in Render dashboard

### **Error: Database connection issues**
- ✅ Run `npm run db:push` to create tables
- ✅ Check DATABASE_URL format is correct
- ✅ Verify PostgreSQL database is running

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

## 📝 **Working Authentication Flow**

After fixes, your authentication should work like this:

1. **Landing Page** (`/`) → Shows sign-in options
2. **Local Login** (`/auth`) → Email/password form
3. **Google Login** → Redirects to Google → Back to your app
4. **Success** → User logged in, redirected to dashboard
5. **Sessions** → Persist across browser refreshes

## ⚡ **Quick Fix Checklist**

- [ ] Added Render URL to Google Cloud Console
- [ ] Set all environment variables in Render
- [ ] Generated and set SESSION_SECRET
- [ ] DATABASE_URL is working
- [ ] Deployed latest code with fixes
- [ ] Tested both login methods
- [ ] Checked Render logs for errors

## 📞 **Still Having Issues?**

If authentication still doesn't work:

1. **Check Render Logs**: Look for specific error messages
2. **Test Local Login First**: If Google OAuth is broken, try email/password
3. **Verify Environment Variables**: Ensure they're all set correctly
4. **Database Connection**: Run `npm run db:push` to ensure tables exist
5. **Clear Browser Data**: Sometimes cached redirects cause issues

**Most authentication issues are caused by missing environment variables or incorrect Google OAuth redirect URIs.**