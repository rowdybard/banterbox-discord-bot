# BanterBox - AI-Powered Streaming Banter Platform

An innovative AI-powered live stream interaction tool that generates real-time, witty responses to Twitch and Discord chat interactions, with TTS audio and customizable overlays.

## 🌟 Features

### Discord Integration
- **Discord Bot Integration** with slash commands (`/link`, `/unlink`, `/status`, `/config`)
- **Real-time Message Processing** - Responds to Discord messages containing "banterbox"
- **Voice Channel Audio** - Plays TTS audio directly in Discord voice channels
- **Guild-based Settings** - Separate configurations per Discord server

### AI & Audio
- **OpenAI GPT Integration** - Generates contextual, personality-driven banter
- **Multiple TTS Providers** - OpenAI TTS and ElevenLabs with emotional expressions
- **Custom Personalities** - 5 predefined templates plus custom AI behavior
- **Emotional Expressions** - Enhanced ElevenLabs output with bracket notation `[chuckles]`

### Streaming Tools
- **Stream Overlay** - Customizable overlay for OBS Browser Source
- **WebSocket Real-time** - Instant banter delivery to overlay
- **Twitch Integration** - EventSub webhooks for chat, subs, donations, raids
- **Usage Analytics** - Daily statistics and Pro upgrade prompts

### User Management
- **Replit OAuth** - Secure authentication via OpenID Connect
- **Pro Access System** - Premium features with advanced customization
- **User Settings** - Voice provider selection and personality configuration

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Discord bot application
- OpenAI API key
- ElevenLabs API key (optional)

### Environment Variables
```bash
# Core Application
NODE_ENV=production
SESSION_SECRET=your_session_secret

# Database
DATABASE_URL=postgresql://user:password@host:port/dbname

# Discord Bot
DISCORD_APPLICATION_ID=your_app_id
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_PUBLIC_KEY=your_public_key

# AI Services
OPENAI_API_KEY=your_openai_key
ELEVENLABS_API_KEY=your_elevenlabs_key
```

### Installation
```bash
npm install
npm run db:push
npm run build
npm start
```

### Discord Bot Setup
1. Create Discord application at [Discord Developer Portal](https://discord.com/developers/applications)
2. Set Interactions Endpoint URL: `https://your-domain.com/api/discord/interactions`
3. Add bot to server with required permissions
4. Use `/link` command to connect Discord server to your account

## 🏗️ Architecture

### Frontend
- **React 18** with TypeScript
- **Vite** for optimized builds
- **Wouter** for lightweight routing
- **TanStack Query** for server state
- **Radix UI + shadcn/ui** components
- **Tailwind CSS** styling

### Backend
- **Express.js** with TypeScript
- **Drizzle ORM** with PostgreSQL
- **WebSocket** real-time communication
- **Discord.js** for bot integration
- **OpenAI** and **ElevenLabs** APIs

### Database Schema
- Users and authentication
- Guild links and settings
- Banter items with audio URLs
- Daily usage statistics

## 🌐 Deployment

### Recommended: Railway or Render
For Discord voice functionality, deploy to Railway or Render (not Replit) due to UDP networking requirements.

#### Railway Deployment
1. Connect GitHub repository to Railway
2. Add PostgreSQL service
3. Configure environment variables
4. Deploy automatically

#### Render Deployment
1. Connect GitHub repository to Render
2. Auto-detects Node.js application
3. Add PostgreSQL database
4. Configure environment variables

### Discord Voice Limitation
⚠️ **Important**: Discord voice connections require UDP networking that doesn't work reliably in Replit's environment. Deploy to Railway, Render, or VPS for full functionality.

## 📝 Usage

### Discord Commands
- `/link` - Connect Discord server to your BanterBox account
- `/unlink` - Disconnect server
- `/status` - Check connection status
- `/config` - View server configuration

### Triggering Banter
- Send messages containing "banterbox" in linked Discord channels
- Bot generates AI responses and plays TTS audio in voice channels
- Banter appears in stream overlay via WebSocket

### Stream Overlay Setup
1. Add Browser Source in OBS
2. Set URL to: `https://your-domain.com/overlay`
3. Configure size and position
4. Overlay displays banter with audio playback

## 🔧 Development

```bash
# Development mode
npm run dev

# Type checking
npm run check

# Database migrations
npm run db:push
```

## 📊 Tech Stack

- **Frontend**: React, TypeScript, Vite, Radix UI, Tailwind CSS
- **Backend**: Express.js, TypeScript, Drizzle ORM
- **Database**: PostgreSQL
- **Real-time**: WebSocket
- **AI/TTS**: OpenAI, ElevenLabs
- **Authentication**: Replit OAuth (OpenID Connect)
- **Discord**: Discord.js, @discordjs/voice

## 🎯 Features Status

- ✅ Discord bot with slash commands
- ✅ Real-time message processing
- ✅ AI banter generation
- ✅ TTS audio generation
- ✅ WebSocket broadcasting
- ✅ Stream overlay system
- ✅ User authentication
- ⚠️ Discord voice playback (requires proper hosting)

## 🔗 Links

- **Discord Bot**: Add to your server via OAuth URL
- **Stream Overlay**: `https://your-domain.com/overlay`
- **Admin Dashboard**: `https://your-domain.com/`

## 📄 License

MIT License - see LICENSE file for details.

---

**Made with ❤️ for streamers who want AI-powered engagement**