# BanterBox - AI-Powered Streaming Banter Platform

## Overview
BanterBox is an AI-powered streaming platform application that generates real-time, witty responses to Twitch and Discord chat interactions, subscriptions, donations, raids, and member events. It aims to enhance live streams by providing intelligent, engaging banter content, converting it to audio, and displaying it via customizable overlays. The platform offers both free and premium tiers, with premium unlocking advanced features like custom voices and enhanced customization. Its business vision is to provide streamers with an intelligent companion that creates engaging banter content, converts it to audio, and displays it through customizable overlays for both Twitch and Discord streaming platforms.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The client is built with **React 18** and **TypeScript**, using **Vite** for optimized builds. It uses **Wouter** for lightweight routing, **TanStack Query** for server state management, **Radix UI** with **shadcn/ui** for UI components, **Tailwind CSS** for styling, and **Framer Motion** for animations. The structure is modular with clear separation between UI, feature, and page components.

### Backend Architecture
The server is implemented using **Express.js** with TypeScript, following RESTful API principles. It includes an API layer for CRUD operations, WebSocket integration for real-time communication, and business logic for OpenAI GPT integration for banter generation and audio processing.

### Data Storage Solutions
The application uses **Drizzle ORM** with **PostgreSQL** as the primary database. The schema supports users, banter items (with event data, content, and audio URLs), user settings, and daily statistics for usage analytics.

### Real-time Communication
A **WebSocket** implementation provides persistent connections between the dashboard and overlay for instant banter delivery, including event broadcasting and automatic reconnection logic.

### Authentication and Authorization
The system includes user authentication using Replit Auth with OpenID Connect, user account management, and Pro access functionality. User ownership verification is implemented for banter access control to ensure multi-user isolation.

### Voice and Audio Processing
AI integration utilizes **OpenAI GPT models** for context-aware banter generation. It supports configurable voice providers and includes robust audio URL management and client-side playback with queue management. All personality prompts are enhanced with explicit ElevenLabs emotional expression instructions to ensure AI compliance with expression requirements.

### Overlay System
The customizable stream overlay is designed for optimal OBS Browser Source integration. It is completely invisible when no banter is active, features a compact, fixed-position banter box, and displays real-time banter synchronized with audio playback. Streamers position and resize the overlay directly within OBS.

### UI/UX Decisions
The design focuses on accessibility and customizability, leveraging Radix UI and Tailwind CSS for a consistent theme. User experience features include an onboarding tutorial system, a usage dashboard with daily limits and upgrade prompts, and a comprehensive Pro upgrade flow. Users can also select from 5 predefined personality templates for banter generation or define their own custom AI behavior.

## External Dependencies

### AI and Voice Services
- **OpenAI API**: For intelligent banter generation and text-to-speech.
- **ElevenLabs**: Alternative voice synthesis provider for premium features.

### Streaming Platform Integration
- **Twitch API**: For OAuth authentication and EventSub webhooks, enabling real-time stream event processing (chat, subscriptions, donations, raids, follows).

### Database and Infrastructure
- **PostgreSQL**: Primary relational database.
- **Neon Database**: Serverless PostgreSQL provider.

### Frontend Libraries
- **React Query**: Server state management.
- **Radix UI**: Accessible UI components.
- **Tailwind CSS**: Styling framework.
- **Framer Motion**: Animation library.
- **Wouter**: Client-side routing.
- **React Hook Form**: Form management with Zod validation.

### Communication and Real-time Features
- **WebSocket (ws)**: Real-time bidirectional communication.
- **Express.js**: HTTP server framework.

## Recent Changes

### Discord Bot Integration Refactor (August 15, 2025)
- ✅ **COMPLETED Major Discord Integration Refactor**
- ❌ **LIMITATION IDENTIFIED: Discord Voice Audio Playback in Replit**
  - **Issue**: While the bot successfully joins voice channels and generates TTS audio, actual audio playback fails in Replit environment
  - **Root Cause**: Discord.js voice connections require UDP networking that doesn't work reliably in Replit's serverless environment
  - **Status**: Bot joins voice channels ✅, Audio generation ✅, WebSocket broadcasting ✅, Voice playback ❌
  - **Solution**: Deploy to Railway for full Discord voice functionality
  - **Date**: August 15, 2025

### Railway Deployment Migration (August 15, 2025)
- 🚀 **PLANNED Railway Deployment**
  - **Reason**: Resolve Discord voice connection UDP networking limitations in Replit
  - **Expected Resolution**: Full Discord voice audio playback functionality
  - **Components Ready**: All core functionality tested and working except voice playback
  - **Date**: August 15, 2025
  - **Architecture Change**: Completely replaced OAuth-based Discord authentication with bot-based slash command system for improved reliability and production readiness on Replit
  - **New Database Schema**: Added `linkCodes`, `guildLinks`, and `guildSettings` tables to support bot-based guild linking and management
  - **Discord Bot System**: Implemented comprehensive Discord bot with slash commands (`/link`, `/unlink`, `/status`, `/config`) for seamless server management
  - **Signature Verification**: Added Discord interaction signature verification using tweetnacl for secure webhook processing
  - **API Endpoints**: Created new bot-focused API routes for link code generation, bot invite URL, and connection status
  - **Frontend Overhaul**: Replaced OAuth-based `DiscordSettings` component with new `DiscordBotSettings` component featuring bot invite flow and real-time link code generation
  - **Storage Layer Updates**: Extended `IStorage` interface and implemented new Discord bot methods in both `MemStorage` and `DatabaseStorage` classes
  - **Command Registration**: Automated Discord slash command registration on server startup with proper error handling
  - **Guild Management**: Implemented per-guild settings and configuration with workspace-based isolation
  - **Voice Channel Integration**: Discord bot joins voice channels when invited by streamers, generating audio banters only during active streaming sessions for optimal performance
  - **Protected Streaming Sessions**: Role-based access control prevents unauthorized users from hijacking active streaming sessions, with streamer identification and admin override capabilities
  - **Production Ready**: Bot-based approach eliminates OAuth callback complexities and provides more reliable Discord integration for Replit hosting

### Previous Discord Integration Implementation (August 14, 2025)
- ✅ **COMPLETED Discord Platform Integration (OAuth-based - now migrated to bot)**
  - All previous OAuth-based Discord integration features have been successfully migrated to the new bot-based system

### ElevenLabs Emotional Expressions Enhancement (August 14, 2025)
- ✅ **COMPLETED ElevenLabs Emotional Expression Integration with Bracket Format**
  - Enhanced all personality prompts with explicit ElevenLabs emotional expression instructions
  - **UPDATED FORMAT**: Changed from parentheses (chuckles) to brackets [chuckles] per user preference
  - Added CRITICAL/IMPORTANT emphasis to ensure AI consistently uses bracket expressions
  - Implemented comprehensive examples: [scoffs], [sighs], [chuckles], [shouts excitedly], [cheers]
  - Fixed LSP errors by adding missing searchBanters method to IStorage interface and implementations
  - Updated system message with extensive list of supported emotional expressions in bracket format
  - Tested successfully across sarcastic, hype, and friendly personalities with consistent bracket results
  - All generated banters now include emotional cues for more engaging ElevenLabs TTS output
  - Complex expressions supported: [chuckles dryly], [sighs dramatically], [laughs warmly]
  - Complete enhancement: AI → ElevenLabs → Natural emotional TTS delivery with bracket notation