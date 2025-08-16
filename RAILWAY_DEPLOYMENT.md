# Railway Deployment Guide

## Why Railway?
Railway deployment is required to resolve Discord voice connection limitations in Replit. Railway provides proper UDP networking support needed for Discord.js voice connections.

## Pre-Deployment Checklist

### 1. Environment Variables
Copy all environment variables from Replit to Railway:

**Required Secrets:**
- `DATABASE_URL` - PostgreSQL connection string
- `DISCORD_APPLICATION_ID` - Discord bot application ID
- `DISCORD_BOT_TOKEN` - Discord bot token
- `DISCORD_CLIENT_ID` - Discord client ID
- `DISCORD_CLIENT_SECRET` - Discord client secret
- `DISCORD_PUBLIC_KEY` - Discord public key
- `OPENAI_API_KEY` - OpenAI API key
- `ELEVENLABS_API_KEY` - ElevenLabs API key
- `SESSION_SECRET` - Session encryption secret
- `TWITCH_CLIENT_ID` - Twitch client ID (optional)
- `TWITCH_CLIENT_SECRET` - Twitch client secret (optional)

**Object Storage (if using):**
- `DEFAULT_OBJECT_STORAGE_BUCKET_ID`
- `PRIVATE_OBJECT_DIR`
- `PUBLIC_OBJECT_SEARCH_PATHS`

### 2. Database Setup
- Create PostgreSQL database in Railway
- Run migrations: `npm run db:push`

### 3. Discord Bot Configuration
Update Discord bot settings with new Railway URLs:
- Interactions Endpoint URL: `https://your-app.railway.app/api/discord/interactions`
- OAuth2 Redirect URLs: `https://your-app.railway.app/api/callback`

## Deployment Steps

### 1. Connect Repository
1. Go to [Railway.app](https://railway.app)
2. Sign up/login with GitHub
3. Create new project from GitHub repository
4. Select your BanterBox repository

### 2. Configure Environment
1. Go to project settings
2. Add all environment variables from checklist above
3. Set `NODE_ENV=production`

### 3. Database Setup
1. Add PostgreSQL service to Railway project
2. Connect database and get connection string
3. Set `DATABASE_URL` environment variable
4. Deploy and run `npm run db:push` to initialize schema

### 4. Discord Configuration
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Update bot interaction endpoints with Railway URL
3. Test bot connection and slash commands

## Post-Deployment Testing

### 1. Core Functions
- [ ] Bot connects to Discord
- [ ] Slash commands work (`/link`, `/status`, `/config`)
- [ ] User authentication via Replit OAuth
- [ ] Database operations function

### 2. Discord Voice Testing
- [ ] Bot joins voice channels
- [ ] TTS audio generation works
- [ ] Audio playback in Discord voice channels (THE KEY TEST!)
- [ ] WebSocket broadcasting to overlay

### 3. Integration Testing
- [ ] Discord message triggers work
- [ ] Audio overlay receives and plays banter
- [ ] Settings and configuration persist

## Expected Resolution
With Railway deployment, Discord voice connections should work properly due to UDP networking support, resolving the core limitation identified in Replit environment.

## Troubleshooting

### Discord Voice Still Not Working
1. Check Discord bot permissions in guild
2. Verify voice connection logs in Railway console
3. Ensure audio files are publicly accessible via HTTPS
4. Test with different Discord channels

### Database Issues
1. Verify `DATABASE_URL` is correctly set
2. Run `npm run db:push` after deployment
3. Check Railway PostgreSQL service status

### Environment Variable Issues
1. Double-check all secrets are properly copied
2. Restart Railway service after adding variables
3. Use Railway CLI for debugging: `railway logs`

## Success Metrics
- ✅ Discord bot joins voice channels
- ✅ Audio generation works
- ✅ WebSocket broadcasting functions
- ✅ **CRITICAL**: Audio playback in Discord voice channels works