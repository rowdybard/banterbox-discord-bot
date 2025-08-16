# BanterBox Deployment Guide

## Render.com Deployment

### Prerequisites
1. GitHub repository with the BanterBox code
2. Render.com account
3. Discord Bot Application and credentials
4. OpenAI API key
5. Google OAuth credentials (optional)
6. ElevenLabs API key (optional)

### Environment Variables Required

#### Core Application
```
NODE_ENV=production
PORT=10000
DATABASE_URL=postgresql://[provided by Render]
SESSION_SECRET=[generate random 32+ character string]
```

#### Discord Bot Integration
```
DISCORD_APPLICATION_ID=[from Discord Developer Portal]
DISCORD_BOT_TOKEN=[from Discord Developer Portal]
DISCORD_CLIENT_ID=[from Discord Developer Portal]
DISCORD_CLIENT_SECRET=[from Discord Developer Portal]
DISCORD_PUBLIC_KEY=[from Discord Developer Portal]
```

#### AI Services
```
OPENAI_API_KEY=[from OpenAI Platform]
ELEVENLABS_API_KEY=[optional - for premium voice features]
```

#### Authentication (Optional)
```
GOOGLE_CLIENT_ID=[from Google Cloud Console]
GOOGLE_CLIENT_SECRET=[from Google Cloud Console]
```

### Deployment Steps

1. **Create New Web Service**
   - Connect your GitHub repository
   - Select `main` branch
   - Use the provided `render.yaml` configuration

2. **Configure Environment Variables**
   - Add all required environment variables in Render dashboard
   - Ensure DATABASE_URL is automatically provided by Render PostgreSQL

3. **Database Setup**
   - Render will automatically create PostgreSQL database
   - Run database migrations: `npm run db:push`

4. **Discord Bot Setup**
   - Set Discord application webhook URL to: `https://your-app-name.onrender.com/api/discord/interactions`
   - Ensure bot has proper permissions in Discord servers

5. **Domain Configuration**
   - Default domain: `https://your-app-name.onrender.com`
   - Custom domains can be configured in Render dashboard

### Post-Deployment

1. **Health Check**: Visit `/api/health` to verify deployment
2. **Discord Integration**: Test Discord slash commands
3. **Authentication**: Test login flows
4. **Banter Generation**: Verify AI integration works

### Common Issues

- **Database Connection**: Ensure DATABASE_URL is correctly set
- **Discord Webhook**: Verify webhook URL in Discord Developer Portal
- **CORS Issues**: Check domain configurations for cross-origin requests
- **Build Failures**: Ensure all dependencies are in package.json

### Monitoring

- Health endpoint: `/api/health`
- Logs available in Render dashboard
- Monitor WebSocket connections for real-time features

### Scaling

- Start with `starter` plan on Render
- Monitor resource usage and upgrade as needed
- Database can be scaled independently

## Manual Production Setup (Alternative)

If not using Render.com, ensure:

1. **Node.js 18+** environment
2. **PostgreSQL** database
3. **Build process**: `npm run build`
4. **Start command**: `npm start`
5. **Health checks** on `/api/health`
6. **HTTPS** required for Discord webhooks and OAuth