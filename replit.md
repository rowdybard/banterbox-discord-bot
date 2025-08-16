# BanterBox - AI-Powered Streaming Banter Platform

## Overview
BanterBox is an AI-powered streaming platform application that generates real-time, witty responses to Twitch and Discord chat interactions, subscriptions, donations, raids, and member events. It aims to enhance live streams by providing intelligent, engaging banter content, converting it to audio, and displaying it via customizable overlays. The platform offers both free and premium tiers, with premium unlocking advanced features like custom voices and enhanced customization. Its business vision is to provide streamers with an intelligent companion that creates engaging banter content, converts it to audio, and displays it through customizable overlays for both Twitch and Discord streaming platforms.

## Recent Changes (August 2025)
- **Audio System Fixed**: OpenAI TTS now generates audio for all new banters, play button functionality restored
- **AI Personality Fixed**: Removed inappropriate user references, added strict prompt controls to prevent name mentions
- **Context Service Disabled**: Temporarily disabled context memory to prevent aggressive user referencing
- **Google OAuth Fixed**: Resolved foreign key constraint violations in user authentication
- **CSS Styles Fixed**: Added proper HTML meta tags for correct styling on deployed site
- **Discord Voice Connection Debug**: Added enhanced logging to diagnose voice channel state mismatch issues
- **Build Syntax Fixed**: Resolved invisible character issues causing Render deployment failures
- **Audio Generation Enhanced**: Audio now always generates for dashboard playback regardless of voice channel status
- **Voice State Auto-Recovery**: Bot now auto-restores voice connections when Discord state mismatches internal tracking
- **Firebase Storage Integration**: Added Firebase Storage for persistent audio file storage across deployments
- **Production Ready**: ✅ **DEPLOYMENT READY** - All critical bugs fixed, audio working, AI behavior corrected, clean syntax

## Deployment Status (August 16, 2025)
- **Build Status**: ✅ Production build successful (`npm run build`)
- **Code Quality**: ✅ Zero TypeScript errors, all LSP diagnostics clear
- **Discord Integration**: ✅ Fully functional - slash commands working, voice channel joining tested
- **AI Generation**: ✅ OpenAI integration working, audio synthesis confirmed
- **WebSocket**: ✅ Real-time communication verified
- **Documentation**: ✅ Complete deployment guides created (README.md, DEPLOYMENT.md, DEPLOYMENT_CHECKLIST.md)
- **Repository**: ✅ Ready for GitHub push with proper .gitignore and environment examples

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The client is built with React 18 and TypeScript, using Vite for optimized builds. It uses Wouter for lightweight routing, TanStack Query for server state management, Radix UI with shadcn/ui for UI components, Tailwind CSS for styling, and Framer Motion for animations. The structure is modular with clear separation between UI, feature, and page components.

### Backend Architecture
The server is implemented using Express.js with TypeScript, following RESTful API principles. It includes an API layer for CRUD operations, WebSocket integration for real-time communication, and business logic for OpenAI GPT integration for banter generation and audio processing.

### Data Storage Solutions
The application uses Drizzle ORM with PostgreSQL as the primary database. The schema supports users, banter items (with event data, content, and audio URLs), user settings, and daily statistics for usage analytics. Audio files are stored in Firebase Storage for persistent cloud storage that survives deployments, with automatic fallback to local filesystem for development environments.

### Real-time Communication
A WebSocket implementation provides persistent connections between the dashboard and overlay for instant banter delivery, including event broadcasting and automatic reconnection logic.

### Authentication and Authorization
The system includes user authentication using Google OAuth and local email/password authentication, user account management, and Pro access functionality. User ownership verification is implemented for banter access control to ensure multi-user isolation.

### Voice and Audio Processing
AI integration utilizes OpenAI GPT models for context-aware banter generation. It supports configurable voice providers and includes robust audio URL management and client-side playback with queue management. All personality prompts are enhanced with explicit ElevenLabs emotional expression instructions to ensure AI compliance with expression requirements, using a bracket format (e.g., [chuckles]).

### Overlay System
The customizable stream overlay is designed for optimal OBS Browser Source integration. It is completely invisible when no banter is active, features a compact, fixed-position banter box, and displays real-time banter synchronized with audio playback. Streamers position and resize the overlay directly within OBS.

### UI/UX Decisions
The design focuses on accessibility and customizability, leveraging Radix UI and Tailwind CSS for a consistent theme. User experience features include an onboarding tutorial system, a usage dashboard with daily limits and upgrade prompts, and a comprehensive Pro upgrade flow. Users can also select from 5 predefined personality templates for banter generation or define their own custom AI behavior, available through an AI Personality Marketplace. This marketplace includes a complete personality builder with ethical guidelines, content filtering, behavior testing, and community features like voting and search.

## External Dependencies

### AI and Voice Services
- **OpenAI API**: For intelligent banter generation and text-to-speech.
- **ElevenLabs**: Alternative voice synthesis provider for premium features.

### Streaming Platform Integration
- **Twitch API**: For OAuth authentication and EventSub webhooks, enabling real-time stream event processing (chat, subscriptions, donations, raids, follows).
- **Discord Bot**: For Discord platform integration, including slash commands for linking, unlinking, status, and configuration, and joining voice channels for audio banter playback.

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