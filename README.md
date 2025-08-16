# BanterBox - AI-Powered Streaming Platform

> Transform your Discord and Twitch streams with AI-generated real-time banter and engagement

## 🚀 Features

- **AI-Powered Banter Generation** - OpenAI integration for intelligent, witty responses
- **Discord Bot Integration** - Slash commands, voice channel joining, real-time chat responses
- **Twitch Integration** - Chat, subscription, donation, and raid event handling
- **Audio Synthesis** - Text-to-speech with OpenAI and ElevenLabs support
- **Real-time Overlays** - WebSocket-powered stream overlays for OBS
- **Personality Marketplace** - Browse and create custom AI personalities
- **Dual Authentication** - Google OAuth and email/password login
- **Pro Features** - Advanced voice options and enhanced customization

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Radix UI
- **Backend**: Express.js, Node.js, WebSocket
- **Database**: PostgreSQL with Drizzle ORM
- **AI/Voice**: OpenAI GPT, ElevenLabs TTS
- **Discord**: Discord.js, Slash Commands, Voice Channels
- **Deployment**: Render.com, Docker-ready

## 🏃‍♂️ Quick Start

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/banterbox.git
   cd banterbox
   ```

2. **Install dependencies**
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Set up environment variables**
   Copy `.env.example` to `.env` and fill in your credentials:
   ```env
   # Database
   DATABASE_URL=postgresql://localhost:5432/banterbox
   
   # Discord Bot
   DISCORD_BOT_TOKEN=your_discord_bot_token
   DISCORD_APPLICATION_ID=your_discord_app_id
   DISCORD_CLIENT_ID=your_discord_client_id
   DISCORD_CLIENT_SECRET=your_discord_client_secret
   DISCORD_PUBLIC_KEY=your_discord_public_key
   
   # AI Services
   OPENAI_API_KEY=your_openai_api_key
   ELEVENLABS_API_KEY=your_elevenlabs_api_key  # Optional
   
   # Authentication
   GOOGLE_CLIENT_ID=your_google_client_id      # Optional
   GOOGLE_CLIENT_SECRET=your_google_client_secret  # Optional
   SESSION_SECRET=your_random_session_secret
   ```

4. **Set up database**
   ```bash
   npm run db:push
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Open browser**
   Navigate to `http://localhost:5000`

### Production Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment instructions for Render.com and other platforms.

## 🎮 Discord Bot Setup

1. **Create Discord Application**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create new application
   - Create bot user and get token

2. **Set Permissions**
   Required bot permissions:
   - Send Messages
   - Use Slash Commands
   - Connect to Voice
   - Speak in Voice

3. **Register Slash Commands**
   Commands are automatically registered on startup:
   - `/link <code>` - Link Discord server to BanterBox
   - `/join <channel>` - Join voice channel for streaming
   - `/leave` - Leave voice channel
   - `/config <setting> <value>` - Configure bot settings
   - `/status` - View current bot status
   - `/unlink` - Unlink Discord server

4. **Set Webhook URL**
   In Discord Developer Portal, set webhook URL to:
   `https://your-domain.com/api/discord/interactions`

## 🎯 Usage

### For Streamers

1. **Sign up** at your deployed BanterBox instance
2. **Link Discord** server using `/link` command
3. **Configure personality** with `/config personality witty`
4. **Join voice channel** with `/join #your-channel`
5. **Start streaming** - AI responds to chat automatically

### For Viewers

- Chat normally in Discord - AI generates responses automatically
- React to messages for additional engagement
- Join/leave events trigger welcome/goodbye banter

## 🔧 Configuration

### Personality Types
- **Witty**: Clever wordplay and smart responses
- **Friendly**: Warm and encouraging
- **Sarcastic**: Playful sarcasm and comebacks
- **Hype**: High-energy excitement
- **Chill**: Relaxed and laid-back

### Voice Providers
- **OpenAI**: Default TTS (free tier included)
- **ElevenLabs**: Premium voices (requires API key)

## 📁 Project Structure

```
banterbox/
├── client/          # React frontend
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Application pages
│   │   └── hooks/       # Custom React hooks
├── server/          # Express backend
│   ├── discord/     # Discord bot integration
│   ├── routes.ts    # API routes
│   └── storage.ts   # Database layer
├── shared/          # Shared TypeScript types
└── docs/           # Documentation
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check [DEPLOYMENT.md](./DEPLOYMENT.md) for setup help
- **Issues**: Open an issue on GitHub
- **Discord**: Join our community Discord server

## 🔗 Links

- [Demo](https://banterbox-demo.onrender.com)
- [Discord Bot Invite](https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=bot%20applications.commands&permissions=3146752)
- [Documentation](./docs/)

---

Built with ❤️ for the streaming community