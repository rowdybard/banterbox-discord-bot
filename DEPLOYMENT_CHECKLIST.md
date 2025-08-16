# 🚀 BanterBox Deployment Checklist

## Pre-Deployment Verification

### ✅ Code Quality
- [ ] All TypeScript errors resolved
- [ ] No console errors in development
- [ ] Build process completes successfully (`npm run build`)
- [ ] Health endpoint responding (`/api/health`)
- [ ] Discord bot commands working locally
- [ ] Audio generation working
- [ ] WebSocket connections stable

### ✅ Environment Configuration
- [ ] All required environment variables documented in `.env.example`
- [ ] Production environment variables prepared (see DEPLOYMENT.md)
- [ ] Database connection string ready
- [ ] Discord bot credentials valid and tested
- [ ] OpenAI API key with sufficient credits
- [ ] Session secret generated (32+ characters)

### ✅ Repository Preparation
- [ ] `.gitignore` excludes sensitive files
- [ ] `README.md` updated with current features
- [ ] `DEPLOYMENT.md` contains deployment instructions
- [ ] `package.json` has correct scripts for production
- [ ] All temporary/test files removed
- [ ] Latest working Discord integration committed

## GitHub Setup

### ✅ Repository Configuration
- [ ] Repository created on GitHub
- [ ] Remote origin configured
- [ ] All files committed and pushed
- [ ] Repository is public (or team has access)
- [ ] README displays correctly on GitHub

### ✅ GitHub Workflows (Optional)
- [ ] CI/CD pipeline configured
- [ ] Automated testing setup
- [ ] Deployment automation configured

## Render.com Deployment

### ✅ Service Configuration
- [ ] New Web Service created on Render
- [ ] GitHub repository connected
- [ ] `render.yaml` configuration verified
- [ ] Build command: `npm install --legacy-peer-deps && npm run build`
- [ ] Start command: `npm start`
- [ ] Health check path: `/api/health`

### ✅ Database Setup
- [ ] PostgreSQL database created on Render
- [ ] Database URL environment variable configured
- [ ] Database migrations run (`npm run db:push`)
- [ ] Database connection verified

### ✅ Environment Variables
Required variables to set in Render dashboard:

**Core:**
- [ ] `NODE_ENV=production`
- [ ] `PORT=10000`
- [ ] `SESSION_SECRET=[your-secret]`
- [ ] `DATABASE_URL=[auto-provided]`

**Discord Integration:**
- [ ] `DISCORD_APPLICATION_ID`
- [ ] `DISCORD_BOT_TOKEN`
- [ ] `DISCORD_CLIENT_ID`
- [ ] `DISCORD_CLIENT_SECRET`
- [ ] `DISCORD_PUBLIC_KEY`

**AI Services:**
- [ ] `OPENAI_API_KEY`
- [ ] `ELEVENLABS_API_KEY` (optional)

**Authentication (optional):**
- [ ] `GOOGLE_CLIENT_ID`
- [ ] `GOOGLE_CLIENT_SECRET`

## Discord Bot Configuration

### ✅ Discord Developer Portal
- [ ] Bot application created
- [ ] Bot token generated and secured
- [ ] Bot permissions configured:
  - Send Messages
  - Use Slash Commands  
  - Connect to Voice
  - Speak in Voice
- [ ] Webhook URL updated to production domain:
  `https://your-app.onrender.com/api/discord/interactions`

### ✅ Slash Commands
Commands should auto-register on deployment:
- [ ] `/link <code>` - Links Discord server
- [ ] `/join <channel>` - Joins voice channel
- [ ] `/leave` - Leaves voice channel  
- [ ] `/config <setting> <value>` - Bot configuration
- [ ] `/status` - Shows bot status
- [ ] `/unlink` - Unlinks Discord server

## Post-Deployment Testing

### ✅ Basic Functionality
- [ ] Application loads successfully
- [ ] Health endpoint returns 200: `https://your-app.onrender.com/api/health`
- [ ] Login/registration works
- [ ] Dashboard displays correctly
- [ ] API endpoints responding

### ✅ Discord Integration
- [ ] Discord slash commands respond
- [ ] Server linking works (`/link`)
- [ ] Voice channel joining works (`/join`)
- [ ] Chat messages trigger banter generation
- [ ] Audio files are generated and accessible

### ✅ Real-time Features
- [ ] WebSocket connections establish
- [ ] Banter appears in real-time
- [ ] Audio playback works
- [ ] Overlay updates automatically

## Production Monitoring

### ✅ Initial Monitoring
- [ ] Application logs reviewed
- [ ] Error tracking configured
- [ ] Performance monitoring setup
- [ ] Database connections stable
- [ ] Memory/CPU usage within limits

### ✅ Scaling Preparation
- [ ] Resource usage monitored
- [ ] Upgrade path planned if needed
- [ ] Backup procedures documented
- [ ] Incident response plan ready

## Final Steps

### ✅ Documentation
- [ ] Update README with production URL
- [ ] Document any deployment-specific configurations
- [ ] Create user onboarding documentation
- [ ] Share Discord bot invite link

### ✅ Community
- [ ] Announce deployment
- [ ] Share documentation with team
- [ ] Set up support channels
- [ ] Plan feature roadmap

---

## Quick Commands Reference

```bash
# Build verification
npm run build

# Health check
curl https://your-app.onrender.com/api/health

# Database migration  
npm run db:push

# Local development
npm run dev
```

## Emergency Rollback

If deployment fails:
1. Check Render logs for errors
2. Verify environment variables
3. Test Discord webhook URL
4. Rollback to previous working commit
5. Redeploy with fixes

---

**Ready for production? 🎉**

Your BanterBox deployment should now be live and ready to enhance Discord streams with AI-powered banter!