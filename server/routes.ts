import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { ObjectStorageService } from "./objectStorage";
import { firebaseStorage } from "./firebase";
import { insertBanterItemSchema, insertUserSettingsSchema, type EventType, type EventData, guildLinks, linkCodes, discordSettings } from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { randomUUID } from "node:crypto";
import { setupAuth, isAuthenticated } from "./localAuth";
import { setupGoogleAuth } from "./googleAuth";
import { setupTwitchAuth } from "./twitchAuth";
import { setupDiscordAuth } from "./discordAuth";
import discordInteractions from "./discord/interactions";
import { ContextService } from "./contextService";
import { registerCommands, getBotInviteUrl } from "./discord/commands";
import TwitchEventSubClient from "./twitch";
import { DiscordService } from "./discord";
import OpenAI from "openai";
import { elevenLabsService } from "./elevenlabs";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "demo_key"
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication middleware (local and Google)
  await setupAuth(app);
  await setupGoogleAuth(app);
  
  // Setup Twitch authentication
  setupTwitchAuth(app);
  
  // Setup Discord authentication
  setupDiscordAuth(app);
  
  // Setup Discord bot interactions
  app.use('/api/discord', discordInteractions);
  
  const httpServer = createServer(app);
  
  // Initialize object storage service
  const objectStorage = new ObjectStorageService();
  
  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Store connected clients
  const clients = new Set<WebSocket>();
  
  // Store active Twitch clients
  const twitchClients = new Map<string, TwitchEventSubClient>();
  
  // Store active Discord clients
  const discordClients = new Map<string, DiscordService>();
  
  // Global Discord service for bot operations
  let globalDiscordService: DiscordService | null = null;
  
  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('Client connected to WebSocket');
    
    ws.on('close', () => {
      clients.delete(ws);
      console.log('Client disconnected from WebSocket');
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });
  
  // Broadcast to all connected clients
  function broadcast(data: any) {
    const message = JSON.stringify(data);
    console.log(`Broadcasting to ${clients.size} clients:`, data);
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
        console.log('Message sent to client');
      } else {
        console.log('Client not ready, removing from set');
        clients.delete(client);
      }
    });
  }

  // Generate banter using GPT
  async function generateBanter(eventType: EventType, eventData: EventData, originalMessage?: string, userId?: string, guildId?: string): Promise<string> {
    try {
      // Get personality settings from web dashboard (source of truth)
      let personalityContext = "Be a human-like personality. Make responses under 20 words with natural conversation. Avoid AI cliches and excessive metaphors.";
      
      // Always use user settings from web dashboard for personality
      if (userId) {
        try {
          const settings = await storage.getUserSettings(userId);
          const personality = settings?.banterPersonality || 'witty';
          const customPrompt = settings?.customPersonalityPrompt;

          if (personality === 'custom' && customPrompt) {
            personalityContext = customPrompt;
          } else {
            const personalityPrompts = {
              witty: "Be witty and clever with natural wordplay and humor. Keep responses under 20 words. Use plain text only.",
              friendly: "Be warm and encouraging with positive energy. Respond naturally and supportively. Use plain text only.",
              sarcastic: "Be playfully sarcastic but fun, not mean. Use clever sarcasm and natural comebacks. Use plain text only.",
              hype: "BE HIGH-ENERGY! Use caps and exclamation points! GET EVERYONE PUMPED UP! Use plain text only.",
              chill: "Stay relaxed and laid-back. Keep responses natural, zen, and easygoing. Use plain text only.",
              roast: "Be playfully roasting and teasing. Use clever burns that are funny, not hurtful. Use plain text only."
            };
            personalityContext = personalityPrompts[personality as keyof typeof personalityPrompts] || personalityPrompts.witty;
          }
          console.log(`Using web dashboard personality: ${personality} for user ${userId}`);
        } catch (error) {
          console.log('Could not load user settings, using default personality');
        }
      }

      // Record this interaction in context memory FIRST
      const contextualUserId = guildId ? (await storage.getGuildLink(guildId))?.workspaceId : userId;
      let contextId: string | null = null;
      
      if (contextualUserId) {
        try {
          contextId = await ContextService.recordEvent(
            contextualUserId,
            eventType,
            eventData,
            guildId,
            eventType === 'discord_message' ? 3 : 2, // Messages are more important for context
            originalMessage
          );
        } catch (contextError) {
          console.error('Error recording context:', contextError);
          // Continue without context if recording fails
        }
      }

      // Get conversation context AFTER recording current event
      let contextString = "";
      
      if (contextualUserId) {
        contextString = await ContextService.getContextForBanter(contextualUserId, eventType, guildId);
        console.log(`Context retrieved for user ${contextualUserId}:`, contextString ? 'Has context' : 'No context');
      }

      let prompt = "";
      
      // Add context to prompt if available
      if (contextString) {
        prompt = `${personalityContext}\n\nContext:\n${contextString}\n\n`;
      } else {
        prompt = `${personalityContext}\n\n`;
      }
      
      switch (eventType) {
        case 'chat':
        case 'discord_message':
          prompt += `Respond to this chat message: "${originalMessage}"`;
          break;
        case 'subscription':
          prompt += `Create a response for a new subscriber.`;
          break;
        case 'donation':
          prompt += `Create a response for a $${eventData.amount} donation${eventData.message ? ` with message: "${eventData.message}"` : ''}.`;
          break;
        case 'raid':
          prompt += `Create a response for a raid with ${eventData.raiderCount} viewers.`;
          break;
        case 'discord_member_join':
          prompt += `Create a welcome response for a new Discord member: "${eventData.displayName}"`;
          break;
        case 'discord_reaction':
          prompt += `Create a response for someone reacting with ${eventData.emoji}`;
          break;
        default:
          prompt += `Respond to this interaction: "${originalMessage}"`;
          break;
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "Generate entertaining responses for live streamers. Keep responses engaging, fun, and under 25 words. Match the personality and energy requested. Use plain text only - no markdown formatting, asterisks, or special characters. Write naturally as if speaking."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 100,
        temperature: 0.9,
      });

      const banterResponse = response.choices[0].message.content || "Thanks for the interaction!";
      
      // Record the AI's response for future context
      if (contextId) {
        try {
          await storage.updateContextResponse(contextId, banterResponse);
        } catch (contextError) {
          console.error('Error updating context response:', contextError);
          // Don't fail banter generation if context update fails
        }
      }
      
      return banterResponse;
    } catch (error) {
      console.error('Error generating banter:', error);
      return "Thanks for the interaction!";
    }
  }

  // Banter generation callback for Twitch events
  async function generateBanterFromTwitchEvent(userId: string, originalMessage: string, eventType: any, eventData: any): Promise<void> {
    try {
      console.log(`Generating banter for Twitch ${eventType} event from user ${userId}`);
      
      // Check daily usage limits
      const usageCheck = await storage.checkAndIncrementDailyUsage(userId);
      if (!usageCheck.allowed) {
        console.log(`Daily limit reached for user ${userId}: ${usageCheck.current}/${usageCheck.limit}`);
        // For Twitch events, we log but don't throw - just skip generation
        return;
      }
      
      // Generate the banter text
      const banterText = await generateBanter(eventType, eventData, originalMessage);
      
      // Get user settings for voice preferences (web dashboard source of truth)
      const userSettings = await storage.getUserSettings(userId);
      const voiceProvider = userSettings?.voiceProvider || 'openai';
      const voiceId = userSettings?.voiceId;
      
      let audioUrl: string | null = null;
      
      // Generate audio using web dashboard voice settings
      try {
        if (voiceProvider === 'elevenlabs') {
          // Use ElevenLabs if configured
          const user = await storage.getUser(userId);
          if (user?.isPro && voiceId) {
            const audioBuffer = await elevenLabsService.generateSpeech(banterText, voiceId);
            if (audioBuffer) {
              // Try Firebase first, fallback to object storage
              audioUrl = await firebaseStorage.saveAudioFile(audioBuffer) || await objectStorage.saveAudioFile(audioBuffer);
            }
          }
        } else {
          // Use OpenAI TTS (default)
          const response = await openai.audio.speech.create({
            model: "tts-1",
            voice: "alloy",
            input: banterText,
          });
          const audioBuffer = Buffer.from(await response.arrayBuffer());
          // Try Firebase first, fallback to object storage
          audioUrl = await firebaseStorage.saveAudioFile(audioBuffer) || await objectStorage.saveAudioFile(audioBuffer);
        }
      } catch (audioError) {
        console.error("Error generating audio:", audioError);
        // Continue without audio
      }
      
      // Create banter item in storage
      const banterItem = await storage.createBanterItem({
        userId,
        eventType,
        eventData,
        originalMessage: originalMessage || '',
        banterText,
        audioUrl: audioUrl || null,
      });
      
      // Broadcast to overlay via WebSocket
      broadcast({
        type: 'new_banter',
        banter: banterItem
      });
      
      console.log(`Successfully generated and broadcast banter for Twitch ${eventType} event`);
    } catch (error) {
      console.error("Error generating banter from Twitch event:", error);
    }
  }

  // Generate TTS audio using the user's preferred voice provider
  async function generateTTS(text: string, userId: string): Promise<Buffer | null> {
    try {
      // Get user settings to determine voice provider
      const settings = await storage.getUserSettings(userId);
      const voiceProvider = settings?.voiceProvider || 'openai';
      
      if (voiceProvider === 'elevenlabs') {
        // Use ElevenLabs for Pro users
        const voiceId = settings?.voiceId || elevenLabsService.getDefaultVoice();
        return await elevenLabsService.generateSpeech(text, voiceId);
      } else {
        // Use OpenAI TTS (default)
        const response = await openai.audio.speech.create({
          model: "tts-1",
          voice: "alloy",
          input: text,
        });
        return Buffer.from(await response.arrayBuffer());
      }
    } catch (error) {
      console.error('Error generating TTS:', error);
      // Fallback to OpenAI if ElevenLabs fails
      try {
        const response = await openai.audio.speech.create({
          model: "tts-1",
          voice: "alloy",
          input: text,
        });
        return Buffer.from(await response.arrayBuffer());
      } catch (fallbackError) {
        console.error('Fallback TTS also failed:', fallbackError);
        return null;
      }
    }
  }

  // Initialize banter generation callback for Twitch events
  function initializeTwitchEventProcessing() {
    // This function will be called when setting up Twitch connections
    // to inject the banter generation callback into active Twitch clients
    twitchClients.forEach(client => {
      client.setBanterGenerationCallback(generateBanterFromTwitchEvent);
    });
  }

  // Generate banter from Discord events
  async function generateBanterFromDiscordEvent(discordUserId: string, originalMessage: string, eventType: string, eventData: any) {
    try {
      console.log(`Generating banter for Discord ${eventType} event:`, eventData);
      
      // Get the workspace owner from guild settings instead of using Discord user ID
      const guildSettings = await storage.getGuildSettings(eventData.guildId);
      if (!guildSettings) {
        console.log('No guild settings found, skipping banter generation');
        return;
      }
      
      const guildLink = await storage.getGuildLink(eventData.guildId);
      const workspaceUserId = guildLink?.workspaceId;
      if (!workspaceUserId) {
        console.log('No workspace user ID found for guild, skipping banter generation');
        return;
      }
      
      // Check daily usage limits using the workspace owner's ID
      const usageCheck = await storage.checkAndIncrementDailyUsage(workspaceUserId);
      if (!usageCheck.allowed) {
        console.log(`Daily limit reached for workspace ${workspaceUserId}: ${usageCheck.current}/${usageCheck.limit}`);
        return;
      }
      
      // Generate banter based on event type  
      const eventTypeForBanter = eventType as EventType;
      
      // originalMessage is now passed as a parameter
      if (!originalMessage) {
        switch (eventType) {
          case 'discord_member_join':
            originalMessage = `${eventData.displayName || eventData.username} joined the server!`;
            break;
          case 'discord_reaction':
            originalMessage = `${eventData.displayName || eventData.username} reacted with ${eventData.emoji}`;
            break;
          default:
            originalMessage = 'Discord event occurred';
        }
      }
      
      const banterText = await generateBanter(eventTypeForBanter, eventData, originalMessage, workspaceUserId, eventData.guildId);
      
      // Always generate TTS audio for banters (for dashboard playback)
      let audioUrl = null;
      
      console.log(`Generating audio for Discord banter`);
      console.log(`globalDiscordService available: ${!!globalDiscordService}`);
      const isInVoiceChannel = globalDiscordService?.isInVoiceChannel(eventData.guildId);
      console.log(`Bot in voice channel for guild ${eventData.guildId}: ${isInVoiceChannel}`);
      
      try {
        // Use web dashboard user settings (source of truth) for voice
        const userSettings = await storage.getUserSettings(workspaceUserId);
        const voiceProvider = userSettings?.voiceProvider || 'openai';
        
        if (voiceProvider === 'elevenlabs') {
          const voiceId = userSettings?.voiceId || elevenLabsService.getDefaultVoice();
          const audioBuffer = await elevenLabsService.generateSpeech(banterText, voiceId);
          if (audioBuffer) {
            // Try Firebase first, fallback to object storage
            audioUrl = await firebaseStorage.saveAudioFile(audioBuffer) || await objectStorage.saveAudioFile(audioBuffer);
          }
        } else {
          // Use OpenAI TTS
          const response = await openai.audio.speech.create({
            model: "tts-1",
            voice: "alloy",
            input: banterText,
          });
          const audioBuffer = Buffer.from(await response.arrayBuffer());
          // Try Firebase first, fallback to object storage
          audioUrl = await firebaseStorage.saveAudioFile(audioBuffer) || await objectStorage.saveAudioFile(audioBuffer);
        }
        console.log(`Generated Discord banter with audio for ${eventType}: "${banterText}"`);
        console.log(`Audio URL generated: ${audioUrl}`);
        console.log(`Global Discord Service available: ${!!globalDiscordService}`);
        
        // Play the audio in Discord voice channel if bot is connected
        if (audioUrl && globalDiscordService && isInVoiceChannel) {
          // Use the public object URL instead of localhost - Discord needs external access
          const renderDomain = process.env.RENDER_EXTERNAL_HOSTNAME;
          console.log(`RENDER_EXTERNAL_HOSTNAME env var: ${process.env.RENDER_EXTERNAL_HOSTNAME}`);
          console.log(`Parsed domain: ${renderDomain}`);
          
          // Handle different audio URL types  
          let publicAudioUrl: string;
          
          if (audioUrl.startsWith('https://storage.googleapis.com/')) {
            // Firebase/GCS URLs are already public
            publicAudioUrl = audioUrl;
            console.log(`Using Firebase audio URL: ${publicAudioUrl}`);
          } else if (audioUrl.startsWith('/public-objects/')) {
            // Local object storage - convert to public URL
            publicAudioUrl = renderDomain 
              ? `https://${renderDomain}${audioUrl}`
              : `http://localhost:5000${audioUrl}`;
            console.log(`Using local storage audio URL: ${publicAudioUrl}`);
          } else {
            // Fallback for other URL formats
            publicAudioUrl = audioUrl;
            console.log(`Using original audio URL: ${publicAudioUrl}`);
          }
          
          console.log(`Attempting to play audio in Discord: ${publicAudioUrl}`);
          
          // Test URL accessibility before trying to play
          try {
            const testResponse = await fetch(publicAudioUrl);
            console.log(`Audio URL test - Status: ${testResponse.status}, Accessible: ${testResponse.ok}`);
          } catch (error) {
            console.log(`Audio URL not accessible:`, error.message);
          }
          
          try {
            const playbackResult = await globalDiscordService.playAudioInVoiceChannel(eventData.guildId, publicAudioUrl);
            console.log(`Audio playback result: ${playbackResult}`);
          } catch (error) {
            console.error(`Error playing audio in Discord:`, error);
          }
        } else {
          console.log(`Skipping Discord audio playback - audioUrl: ${!!audioUrl}, globalDiscordService: ${!!globalDiscordService}, isInVoiceChannel: ${isInVoiceChannel}`);
        }
      } catch (audioError) {
        console.error("Error generating Discord audio:", audioError);
        // Continue without audio
      }
      
      // Create banter item in storage
      const banterItem = await storage.createBanterItem({
        userId: workspaceUserId,
        eventType: eventTypeForBanter,
        eventData,
        originalMessage: originalMessage || '',
        banterText,
        audioUrl: audioUrl || null,
      });
      
      // Broadcast to overlay via WebSocket
      broadcast({
        type: 'new_banter',
        banter: banterItem
      });
      
      console.log(`Successfully generated and broadcast banter for Discord ${eventType} event`);
    } catch (error) {
      console.error("Error generating banter from Discord event:", error);
    }
  }

  // API Routes
  
  // Health check endpoint for offline detection
  app.get('/api/health', (req, res) => {
    const discordStatus = globalDiscordService ? globalDiscordService.getConnectionStatus() : null;
    
    res.status(200).json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      discord: discordStatus ? {
        isReady: discordStatus.isReady,
        isReconnecting: discordStatus.isReconnecting,
        reconnectAttempts: discordStatus.reconnectAttempts,
        voiceConnections: discordStatus.voiceConnections,
        guilds: discordStatus.guilds,
        healthy: globalDiscordService?.isHealthy() || false
      } : null
    });
  });
  
  // Complete onboarding endpoint
  app.post('/api/user/complete-onboarding', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      await storage.completeOnboarding(userId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error completing onboarding:', error);
      res.status(500).json({ message: 'Failed to complete onboarding' });
    }
  });

  // Search banters endpoint
  app.get('/api/banter/search', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { query, eventType, limit } = req.query;
      
      const banters = await storage.searchBanters(
        userId, 
        query || '', 
        eventType || 'all',
        limit ? parseInt(limit) : 20
      );
      
      res.json(banters);
    } catch (error) {
      console.error('Error searching banters:', error);
      res.status(500).json({ message: 'Failed to search banters' });
    }
  });
  
  // Serve public audio files (fallback for non-Firebase audio)
  app.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    
    // Add CORS headers for audio files to enable cross-origin access
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Range");
    res.header("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Encoding, Content-Length");
    
    try {
      // Check if this is a Firebase-stored file that was missed
      if (filePath.startsWith('audio/') && firebaseStorage.isAvailable()) {
        console.log(`Audio file ${filePath} should be served from Firebase, not local storage`);
        return res.status(404).json({ 
          error: "Audio file not found in local storage",
          hint: "This file may be stored in Firebase. Please check your Firebase configuration."
        });
      }
      
      const file = await objectStorage.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "Audio file not found" });
      }
      objectStorage.downloadObject(file, res);
    } catch (error) {
      console.error("Error serving audio file:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Get user settings
  app.get("/api/settings/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const authenticatedUserId = req.user.id;
      
      // Users can only access their own settings
      if (userId !== authenticatedUserId && userId !== "demo-user") {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const settings = await storage.getUserSettings(userId);
      
      if (!settings) {
        // Create default settings if they don't exist
        const defaultSettings = await storage.createUserSettings({
          userId,
          voiceProvider: 'openai',
          voiceId: null,
          autoPlay: true,
          volume: 75,
          enabledEvents: ['chat'],
          overlayPosition: 'bottom-center',
          overlayDuration: 5,
          overlayAnimation: 'fade',
          banterPersonality: 'witty',
          customPersonalityPrompt: null,
        });
        return res.json(defaultSettings);
      }
      
      res.json(settings);
    } catch (error) {
      console.error('Error getting user settings:', error);
      res.status(500).json({ message: "Failed to get settings" });
    }
  });

  // Update user settings
  app.put("/api/settings/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const authenticatedUserId = req.user.id;
      const updates = req.body;
      
      // Users can only update their own settings
      if (userId !== authenticatedUserId && userId !== "demo-user") {
        return res.status(403).json({ message: "Access denied" });
      }
      
      let updated = await storage.updateUserSettings(userId, updates);
      
      // If settings don't exist, create them first
      if (!updated) {
        const newSettings = await storage.createUserSettings({
          userId,
          voiceProvider: updates.voiceProvider || 'openai',
          voiceId: updates.voiceId || null,
          autoPlay: updates.autoPlay ?? true,
          volume: updates.volume || 75,
          enabledEvents: updates.enabledEvents || ['chat'],
          overlayPosition: updates.overlayPosition || 'bottom-center',
          overlayDuration: updates.overlayDuration || 5,
          overlayAnimation: updates.overlayAnimation || 'fade',
          banterPersonality: updates.banterPersonality || 'witty',
          customPersonalityPrompt: updates.customPersonalityPrompt || null,
        });
        updated = newSettings;
      }
      
      res.json(updated);
    } catch (error) {
      console.error('Error updating user settings:', error);
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  // Get banter queue
  app.get("/api/banter/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const banters = await storage.getBantersByUser(userId, limit);
      res.json(banters);
    } catch (error) {
      console.error('Error getting banter queue:', error);
      res.status(500).json({ message: "Failed to get banter queue" });
    }
  });

  // Generate new banter
  app.post("/api/banter/generate", async (req, res) => {
    try {
      const { userId, eventType, eventData, originalMessage } = req.body;
      
      // Check daily usage limits
      const usageCheck = await storage.checkAndIncrementDailyUsage(userId);
      if (!usageCheck.allowed) {
        return res.status(429).json({ 
          message: `Daily limit reached. You've used ${usageCheck.current} of ${usageCheck.limit} banters today.`,
          usage: usageCheck,
          upgrade: !usageCheck.isPro ? "Upgrade to Pro for unlimited banters!" : null
        });
      }
      
      // Generate banter text with user personality
      const banterText = await generateBanter(eventType, eventData, originalMessage, userId);
      
      // Create banter item
      const banterItem = await storage.createBanterItem({
        userId,
        originalMessage,
        banterText,
        eventType,
        eventData,
        isPlayed: false,
      });

      // Generate TTS audio
      try {
        const audioBuffer = await generateTTS(banterText, userId);
        if (audioBuffer) {
          // Save audio to object storage
          const audioUrl = await firebaseStorage.saveAudioFile(audioBuffer) || await objectStorage.saveAudioFile(audioBuffer);
          await storage.updateBanterItem(banterItem.id, { audioUrl });
          banterItem.audioUrl = audioUrl;
        }
      } catch (audioError) {
        console.error('TTS generation failed:', audioError);
        // Continue without audio
      }

      // Update daily stats
      const today = new Date().toISOString().split('T')[0];
      const stats = await storage.getDailyStats(userId, today);
      if (stats) {
        await storage.updateDailyStats(userId, today, {
          bantersGenerated: (stats.bantersGenerated || 0) + 1,
          chatResponses: eventType === 'chat' ? (stats.chatResponses || 0) + 1 : (stats.chatResponses || 0),
        });
      }

      // Broadcast to connected clients
      broadcast({
        type: 'new_banter',
        data: banterItem
      });

      res.json(banterItem);
    } catch (error) {
      console.error('Error generating banter:', error);
      res.status(500).json({ message: "Failed to generate banter" });
    }
  });

  // Play banter (mark as played)
  app.post("/api/banter/:id/play", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      // Verify the banter belongs to the authenticated user
      const banter = await storage.getBanterItem(id);
      if (!banter) {
        return res.status(404).json({ message: "Banter not found" });
      }
      
      if (banter.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updated = await storage.updateBanterItem(id, { isPlayed: true });

      // Broadcast play event with WebSocket
      broadcast({
        type: 'banter_played',
        data: updated
      });

      res.json(updated);
    } catch (error) {
      console.error("Error playing banter:", error);
      res.status(500).json({ message: "Failed to mark banter as played" });
    }
  });

  // Replay banter (mark as unplayed and move to top)
  app.post("/api/banter/:id/replay", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      // Verify the banter belongs to the authenticated user
      const banter = await storage.getBanterItem(id);
      if (!banter) {
        return res.status(404).json({ message: "Banter not found" });
      }
      
      if (banter.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Mark as unplayed and update timestamp to move to top
      const updated = await storage.updateBanterItem(id, { 
        isPlayed: false,
        createdAt: new Date()
      });

      // Broadcast replay event with WebSocket
      broadcast({
        type: 'banter_replayed',
        data: updated
      });

      res.json(updated);
    } catch (error) {
      console.error("Error replaying banter:", error);
      res.status(500).json({ message: "Failed to replay banter" });
    }
  });

  // Update banter
  app.put("/api/banter/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { banterText } = req.body;
      
      if (!banterText || !banterText.trim()) {
        return res.status(400).json({ message: "Banter text is required" });
      }
      
      const updated = await storage.updateBanterItem(id, { banterText: banterText.trim() });
      if (!updated) {
        return res.status(404).json({ message: "Banter not found" });
      }

      // Broadcast update event
      broadcast({
        type: 'banter_updated',
        data: updated
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update banter" });
    }
  });

  // Delete banter
  app.delete("/api/banter/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      const success = await storage.deleteBanterItem(id);
      if (!success) {
        return res.status(404).json({ message: "Banter not found" });
      }

      // Broadcast deletion
      broadcast({
        type: 'banter_deleted',
        data: { id }
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete banter" });
    }
  });

  // Get daily stats
  app.get("/api/stats/:userId", async (req, res) => {
    const { userId } = req.params;
    try {
      const date = req.query.date as string || new Date().toISOString().split('T')[0];
      
      let stats = await storage.getDailyStats(userId, date);
      
      // If no stats exist, return default values instead of 404
      if (!stats) {
        console.log(`No stats found for user ${userId} on ${date}, returning default values`);
        const defaultStats = {
          id: randomUUID(),
          userId,
          date,
          bantersGenerated: 0,
          bantersPlayed: 0,
          chatResponses: 0,
          audioGenerated: 0,
          viewerEngagement: 0,
          peakHour: null,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        res.json(defaultStats);
        return;
      }
      
      console.log(`Stats found for user ${userId} on ${date}`);
      res.json(stats);
    } catch (error) {
      console.error(`Error getting stats for user ${userId}:`, error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to get stats" });
    }
  });

  // Discord Bot API endpoints
  
  // Generate a link code for Discord bot linking
  app.post("/api/discord/link-code", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
  
      // Generate a random 8-character code
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  
      const linkCode = await storage.createLinkCode({
        code,
        workspaceId: userId,
        expiresAt,
      });
  
      res.json({ 
        code: linkCode.code, 
        expiresAt: linkCode.expiresAt,
        instructions: `Use this code in Discord: /link ${linkCode.code}`
      });
    } catch (error) {
      console.error('Error generating link code:', error);
      res.status(500).json({ message: "Failed to generate link code" });
    }
  });
  
  // Get Discord bot invite URL
  app.get("/api/discord/bot-invite", (req, res) => {
    try {
      const inviteUrl = getBotInviteUrl();
      res.json({ inviteUrl });
    } catch (error) {
      console.error('Error getting bot invite URL:', error);
      res.status(500).json({ message: "Failed to get bot invite URL" });
    }
  });
  
  // Get Discord bot connection status
  app.get("/api/discord/status/:userId", isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.params;
      const authenticatedUserId = req.user.id;
      
      // Ensure user can only access their own data
      if (userId !== authenticatedUserId) {
        return res.status(403).json({ message: "Access denied" });
      }
  
      // Find all guild links for this workspace
      const allGuildLinks = await db.select().from(guildLinks).where(eq(guildLinks.workspaceId, userId));
      const activeGuildLinks = allGuildLinks.filter(link => link.active);
      
      // Check actual bot presence if Discord service is available
      let verifiedGuilds: any[] = [];
      let staleConnections = 0;
      
      if (globalDiscordService) {
        for (const link of activeGuildLinks) {
          const isActuallyInGuild = globalDiscordService.isActuallyInGuild(link.guildId);
          
          if (isActuallyInGuild) {
            // Get guild info from Discord
            const discordGuilds = globalDiscordService.getCurrentGuilds();
            const guildInfo = discordGuilds.find(g => g.id === link.guildId);
            
            verifiedGuilds.push({
              guildId: link.guildId,
              guildName: guildInfo?.name || 'Unknown',
              linkedByUserId: link.linkedByUserId,
              createdAt: link.createdAt,
              verified: true
            });
          } else {
            // Guild link exists but bot is not actually in guild
            staleConnections++;
            console.log(`Stale guild connection detected: ${link.guildId}`);
          }
        }
      } else {
        // Bot not connected, treat all as unverified
        verifiedGuilds = activeGuildLinks.map(link => ({
          guildId: link.guildId,
          linkedByUserId: link.linkedByUserId,
          createdAt: link.createdAt,
          verified: false
        }));
      }
  
      // Get Discord service status
      const discordServiceStatus = globalDiscordService ? globalDiscordService.getConnectionStatus() : null;
      const autoReconnectStatus = globalDiscordService ? globalDiscordService.getAutoReconnectStatus() : null;
  
      res.json({
        isConnected: verifiedGuilds.length > 0,
        connectedGuilds: verifiedGuilds.length,
        totalGuildLinks: activeGuildLinks.length,
        staleConnections,
        botOnline: !!globalDiscordService,
        botHealthy: globalDiscordService?.isHealthy() || false,
        guilds: verifiedGuilds,
        serviceStatus: discordServiceStatus,
        autoReconnect: autoReconnectStatus
      });
    } catch (error) {
      console.error('Error getting Discord status:', error);
      res.status(500).json({ message: "Failed to get Discord status" });
    }
  });

  // Clean up stale Discord connections
  app.post("/api/discord/cleanup-stale", isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.body;
      const authenticatedUserId = req.user.id;
      
      // Ensure user can only clean their own data
      if (userId !== authenticatedUserId) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!globalDiscordService) {
        return res.status(503).json({ message: "Discord bot not connected" });
      }

      // Find all guild links for this workspace
      const allGuildLinks = await db.select().from(guildLinks).where(eq(guildLinks.workspaceId, userId));
      const activeGuildLinks = allGuildLinks.filter(link => link.active);
      
      let cleanedUp = 0;
      
      for (const link of activeGuildLinks) {
        const isActuallyInGuild = globalDiscordService.isActuallyInGuild(link.guildId);
        
        if (!isActuallyInGuild) {
          // Bot is not actually in this guild, deactivate the link
          await storage.deactivateGuildLink(link.guildId);
          await storage.clearCurrentStreamer(link.guildId);
          cleanedUp++;
          console.log(`Cleaned up stale guild link: ${link.guildId}`);
        }
      }

      res.json({
        success: true,
        cleanedUp,
        message: `Cleaned up ${cleanedUp} stale connections`
      });
    } catch (error) {
      console.error('Error cleaning up stale connections:', error);
      res.status(500).json({ message: "Failed to clean up stale connections" });
    }
  });

  // Emergency Discord bot restart (admin only)
  app.post("/api/discord/restart", isAuthenticated, async (req, res) => {
    try {
      const authenticatedUserId = req.user.id;
      
      // Only allow restart if Discord service exists and is unhealthy
      if (!globalDiscordService) {
        return res.status(503).json({ message: "Discord bot not initialized" });
      }

      if (globalDiscordService.isHealthy()) {
        return res.status(400).json({ message: "Discord bot is healthy, restart not needed" });
      }

      console.log(`🔄 Emergency Discord bot restart requested by user ${authenticatedUserId}`);
      
      // Disconnect current service
      globalDiscordService.disconnect();
      
      // Wait a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Reinitialize Discord service
      if (process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_CLIENT_ID) {
        globalDiscordService = new DiscordService({
          token: process.env.DISCORD_BOT_TOKEN,
          clientId: process.env.DISCORD_CLIENT_ID,
          clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
        });
        
        globalDiscordService.setBanterCallback(generateBanterFromDiscordEvent);
        await globalDiscordService.connect();
        
        // Set the service in slash command handler
        const { setDiscordService } = await import('./discord/slash');
        setDiscordService(globalDiscordService);
        
        console.log('✅ Discord bot restarted successfully');
        
        res.json({
          success: true,
          message: "Discord bot restarted successfully",
          status: globalDiscordService.getConnectionStatus()
        });
      } else {
        throw new Error("Discord bot credentials not configured");
      }
    } catch (error) {
      console.error('Error restarting Discord bot:', error);
      res.status(500).json({ message: "Failed to restart Discord bot", error: error.message });
    }
  });

  // Manage favorite personalities
  app.post("/api/favorites/personalities", isAuthenticated, async (req, res) => {
    try {
      const { name, prompt, description } = req.body;
      const userId = req.user.id;
      
      if (!name || !prompt) {
        return res.status(400).json({ message: "Name and prompt are required" });
      }
      
      const settings = await storage.getUserSettings(userId);
      const currentFavorites = settings?.favoritePersonalities || [];
      
      const newPersonality = {
        id: randomUUID(),
        name,
        prompt,
        description: description || "",
        createdAt: new Date()
      };
      
      const updatedFavorites = [...currentFavorites, newPersonality];
      
      await storage.updateUserSettings(userId, {
        favoritePersonalities: updatedFavorites
      });
      
      res.json({ success: true, personality: newPersonality });
    } catch (error) {
      console.error('Error saving favorite personality:', error);
      res.status(500).json({ message: "Failed to save personality" });
    }
  });

  app.get("/api/favorites/personalities", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.id;
      const settings = await storage.getUserSettings(userId);
      const favorites = settings?.favoritePersonalities || [];
      
      res.json({ personalities: favorites });
    } catch (error) {
      console.error('Error getting favorite personalities:', error);
      res.status(500).json({ message: "Failed to get personalities" });
    }
  });

  app.delete("/api/favorites/personalities/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      const settings = await storage.getUserSettings(userId);
      const currentFavorites = settings?.favoritePersonalities || [];
      const updatedFavorites = currentFavorites.filter((p: any) => p.id !== id);
      
      await storage.updateUserSettings(userId, {
        favoritePersonalities: updatedFavorites
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting favorite personality:', error);
      res.status(500).json({ message: "Failed to delete personality" });
    }
  });

  // Manage favorite voices
  app.post("/api/favorites/voices", isAuthenticated, async (req, res) => {
    try {
      const { name, voiceId, provider, description } = req.body;
      const userId = req.user.id;
      
      if (!name || !voiceId || !provider) {
        return res.status(400).json({ message: "Name, voiceId, and provider are required" });
      }
      
      const settings = await storage.getUserSettings(userId);
      const currentFavorites = settings?.favoriteVoices || [];
      
      const newVoice = {
        id: randomUUID(),
        name,
        voiceId,
        provider,
        description: description || "",
        createdAt: new Date()
      };
      
      const updatedFavorites = [...currentFavorites, newVoice];
      
      await storage.updateUserSettings(userId, {
        favoriteVoices: updatedFavorites
      });
      
      res.json({ success: true, voice: newVoice });
    } catch (error) {
      console.error('Error saving favorite voice:', error);
      res.status(500).json({ message: "Failed to save voice" });
    }
  });

  app.get("/api/favorites/voices", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.id;
      const settings = await storage.getUserSettings(userId);
      const favorites = settings?.favoriteVoices || [];
      
      res.json({ voices: favorites });
    } catch (error) {
      console.error('Error getting favorite voices:', error);
      res.status(500).json({ message: "Failed to get voices" });
    }
  });

  app.delete("/api/favorites/voices/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      const settings = await storage.getUserSettings(userId);
      const currentFavorites = settings?.favoriteVoices || [];
      const updatedFavorites = currentFavorites.filter((v: any) => v.id !== id);
      
      await storage.updateUserSettings(userId, {
        favoriteVoices: updatedFavorites
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting favorite voice:', error);
      res.status(500).json({ message: "Failed to delete voice" });
    }
  });

  // Test personality system
  app.post("/api/test-personality", isAuthenticated, async (req, res) => {
    try {
      const { personality, message } = req.body;
      const userId = req.user.id;
      
      console.log(`🧪 Testing personality: ${personality} for user: ${userId}`);
      
      // Update web dashboard user settings if personality provided
      if (personality) {
        await storage.updateUserSettings(userId, {
          banterPersonality: personality
        });
        console.log(`✅ Updated user ${userId} personality to: ${personality}`);
      }
      
      // Test banter generation
      const testMessage = message || "Hey banterbox, test the personality!";
      const eventData = {
        displayName: "TestUser",
        messageContent: testMessage
      };
      
      const banterResponse = await generateBanter(
        'chat',
        eventData,
        testMessage,
        userId
      );
      
      // Get current user settings to verify
      const currentSettings = await storage.getUserSettings(userId);
      
      res.json({
        success: true,
        testMessage,
        banterResponse,
        appliedPersonality: currentSettings?.banterPersonality || 'default',
        userId,
        settings: currentSettings
      });
    } catch (error) {
      console.error('Personality test error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        stack: error.stack 
      });
    }
  });

  // Test Discord database operations
  app.post("/api/discord/test-db", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.id;
      console.log(`🧪 Testing Discord DB operations for user: ${userId}`);
      
      const results = {
        tests: [],
        success: true,
        errors: []
      };
      
      // Test 1: Create a test link code
      try {
        const testCode = Math.random().toString(36).substring(2, 10).toUpperCase();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        
        console.log(`Testing createLinkCode with code: ${testCode}`);
        const linkCode = await storage.createLinkCode({
          code: testCode,
          workspaceId: userId,
          expiresAt,
        });
        
        results.tests.push({
          name: 'createLinkCode',
          status: 'PASS',
          data: { code: linkCode.code, id: linkCode.id }
        });
        
        // Test 2: Retrieve the link code
        console.log(`Testing getLinkCode with code: ${testCode}`);
        const retrievedCode = await storage.getLinkCode(testCode);
        
        if (retrievedCode && retrievedCode.code === testCode) {
          results.tests.push({
            name: 'getLinkCode',
            status: 'PASS',
            data: { found: true, code: retrievedCode.code }
          });
        } else {
          throw new Error('Link code not found after creation');
        }
        
        // Test 3: Test guild link creation (fake guild ID)
        const testGuildId = '123456789012345678';
        console.log(`Testing createGuildLink with guild: ${testGuildId}`);
        
        const guildLink = await storage.createGuildLink({
          guildId: testGuildId,
          workspaceId: userId,
          linkedByUserId: 'test-user-123',
          active: true,
        });
        
        results.tests.push({
          name: 'createGuildLink',
          status: 'PASS',
          data: { guildId: guildLink.guildId, id: guildLink.id }
        });
        
        // Test 4: Test guild settings
        console.log(`Testing upsertGuildSettings for guild: ${testGuildId}`);
        
        const guildSettings = await storage.upsertGuildSettings({
          guildId: testGuildId,
          workspaceId: userId,
          personality: 'test',
          voiceProvider: 'openai',
          enabledEvents: ['test_event'],
          updatedAt: new Date(),
        });
        
        results.tests.push({
          name: 'upsertGuildSettings',
          status: 'PASS',
          data: { guildId: guildSettings.guildId }
        });
        
        // Cleanup test data
        await storage.deactivateGuildLink(testGuildId);
        await storage.consumeLinkCode(testCode);
        
        results.tests.push({
          name: 'cleanup',
          status: 'PASS',
          data: { message: 'Test data cleaned up' }
        });
        
      } catch (error) {
        results.success = false;
        results.errors.push({
          test: 'database_operations',
          error: error.message,
          stack: error.stack
        });
        console.error('Database test error:', error);
      }
      
      res.json(results);
    } catch (error) {
      console.error('Test endpoint error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        stack: error.stack 
      });
    }
  });

  // Clear ALL Discord cache/connections for fresh start
  app.post("/api/discord/clear-cache", isAuthenticated, async (req, res) => {
    try {
      const authenticatedUserId = req.user.id;
      console.log(`🧹 Clearing ALL Discord cache for user ${authenticatedUserId}`);
      
      let totalCleared = 0;
      
      // 1. Clear all guild links for this user
      const allGuildLinks = await db.select().from(guildLinks).where(eq(guildLinks.workspaceId, authenticatedUserId));
      for (const link of allGuildLinks) {
        await storage.deactivateGuildLink(link.guildId);
        await storage.clearCurrentStreamer(link.guildId);
        totalCleared++;
        console.log(`❌ Deactivated guild link: ${link.guildId}`);
      }
      
      // 2. Clear all active link codes for this user
      await db.update(linkCodes)
        .set({ consumedAt: new Date() })
        .where(eq(linkCodes.workspaceId, authenticatedUserId));
      console.log(`❌ Expired all link codes for user`);
      
      // 3. Clear voice connections from memory if Discord service is available
      if (globalDiscordService) {
        for (const link of allGuildLinks) {
          // Force leave any voice channels
          try {
            await globalDiscordService.leaveVoiceChannel(link.guildId);
            console.log(`❌ Left voice channel in guild: ${link.guildId}`);
          } catch (error) {
            // Ignore errors, guild might not exist
          }
        }
      }
      
      // 4. Clear any legacy Discord settings
      try {
        await db.update(discordSettings)
          .set({ 
            isConnected: false, 
            connectedGuilds: null,
            updatedAt: new Date()
          })
          .where(eq(discordSettings.userId, authenticatedUserId));
        console.log(`❌ Cleared legacy Discord settings`);
      } catch (error) {
        // Ignore if table doesn't exist or user has no settings
      }

      res.json({
        success: true,
        cleared: totalCleared,
        message: `🧹 Successfully cleared ALL Discord cache! Removed ${totalCleared} guild connections. You can now re-add the bot fresh.`,
        actions: [
          'Deactivated all guild links',
          'Expired all link codes',
          'Left all voice channels',
          'Cleared legacy settings'
        ]
      });
    } catch (error) {
      console.error('Error clearing Discord cache:', error);
      res.status(500).json({ message: "Failed to clear Discord cache" });
    }
  });

  // Simple broadcast test endpoint
  app.post("/api/broadcast-test", async (req, res) => {
    console.log('BROADCAST TEST ENDPOINT CALLED');
    
    const testBanter = {
      id: 'test-' + Date.now(),
      userId: '44466017',
      originalMessage: 'Broadcast test message',
      banterText: 'This is a real-time broadcast test!',
      eventType: 'chat',
      eventData: { username: 'test_user' },
      isPlayed: false,
      createdAt: new Date().toISOString()
    };

    console.log('Broadcasting test message...');
    broadcast({
      type: 'new_banter',
      data: testBanter
    });
    console.log('Broadcast sent successfully');

    res.json({ success: true, message: 'Broadcast test sent', data: testBanter });
  });

  // Generate test banter (simple endpoint for testing)
  app.post("/api/banter/:userId/test", async (req, res) => {
    console.log('Real test banter endpoint called');
    try {
      const { userId } = req.params;
      const { message } = req.body;
      
      // Check daily usage limits
      const usageCheck = await storage.checkAndIncrementDailyUsage(userId);
      if (!usageCheck.allowed) {
        return res.status(429).json({ 
          message: `Daily limit reached. You've used ${usageCheck.current} of ${usageCheck.limit} banters today.`,
          usage: usageCheck,
          upgrade: !usageCheck.isPro ? "Upgrade to Pro for unlimited banters!" : null
        });
      }
      
      // Generate test banter
      const testMessage = message || "This is a test message for BanterBox!";
      const banterText = await generateBanter('chat', { username: 'test_viewer' }, testMessage, userId);
      
      const banterItem = await storage.createBanterItem({
        userId,
        originalMessage: testMessage,
        banterText,
        eventType: 'chat',
        eventData: { username: 'test_viewer' },
        isPlayed: false,
      });

      // Broadcast IMMEDIATELY - before audio generation
      console.log('Broadcasting real test banter to clients...');
      broadcast({
        type: 'new_banter',
        data: banterItem
      });
      console.log('Real test banter broadcast completed');

      // Generate TTS audio (async in background)
      try {
        const audioBuffer = await generateTTS(banterText, userId);
        if (audioBuffer) {
          const audioUrl = await firebaseStorage.saveAudioFile(audioBuffer) || await objectStorage.saveAudioFile(audioBuffer);
          await storage.updateBanterItem(banterItem.id, { audioUrl });
          banterItem.audioUrl = audioUrl;
          
          // Broadcast updated banter with audio
          console.log('Broadcasting updated banter with audio...');
          broadcast({
            type: 'banter_updated',
            data: { ...banterItem, audioUrl }
          });
        }
      } catch (audioError) {
        console.error('TTS generation failed:', audioError);
      }

      console.log('Test banter completed:', banterItem);
      res.json(banterItem);
    } catch (error) {
      console.error('Error generating test banter:', error);
      res.status(500).json({ message: "Failed to generate test banter" });
    }
  });

  // Simulate chat message (for testing - authenticated users only)
  app.post("/api/simulate/chat", isAuthenticated, async (req: any, res) => {
    try {
      const { username, message } = req.body;
      const userId = req.user.id; // Use authenticated user ID
      
      // Check daily usage limits
      const usageCheck = await storage.checkAndIncrementDailyUsage(userId);
      if (!usageCheck.allowed) {
        return res.status(429).json({ 
          message: `Daily limit reached. You've used ${usageCheck.current} of ${usageCheck.limit} banters today.`,
          usage: usageCheck,
          upgrade: !usageCheck.isPro ? "Upgrade to Pro for unlimited banters!" : null
        });
      }
      
      // Generate banter for the simulated chat with user personality
      const banterText = await generateBanter('chat', { username }, message, userId);
      
      const banterItem = await storage.createBanterItem({
        userId,
        originalMessage: message,
        banterText,
        eventType: 'chat',
        eventData: { username },
        isPlayed: false,
      });

      // Generate TTS with user settings
      try {
        const audioBuffer = await generateTTS(banterText, userId);
        if (audioBuffer) {
          // Save audio to object storage
          const audioUrl = await firebaseStorage.saveAudioFile(audioBuffer) || await objectStorage.saveAudioFile(audioBuffer);
          await storage.updateBanterItem(banterItem.id, { audioUrl });
          banterItem.audioUrl = audioUrl;
        }
      } catch (audioError) {
        console.error('TTS generation failed:', audioError);
        // Continue without audio
      }

      // Broadcast the new banter
      broadcast({
        type: 'new_banter',
        data: banterItem
      });

      res.json(banterItem);
    } catch (error) {
      console.error('Error simulating chat:', error);
      res.status(500).json({ message: "Failed to simulate chat" });
    }
  });

  // Authentication routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Get ElevenLabs voices (Pro users only)
  app.get('/api/elevenlabs/voices', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user?.isPro) {
        return res.status(403).json({ message: "Pro subscription required" });
      }

      const voices = elevenLabsService.getPopularVoices();
      res.json(voices);
    } catch (error) {
      console.error("Error fetching ElevenLabs voices:", error);
      res.status(500).json({ message: "Failed to fetch voices" });
    }
  });

  // Test ElevenLabs voice (Pro users only)
  app.post('/api/elevenlabs/test-voice', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user?.isPro) {
        return res.status(403).json({ message: "Pro subscription required" });
      }

      const { voiceId, text } = req.body;
      const testText = text || "Hello! This is a test of your selected voice.";
      
      const audioBuffer = await elevenLabsService.generateSpeech(testText, voiceId);
      
      // Set appropriate headers for audio
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length,
      });
      
      res.send(audioBuffer);
    } catch (error) {
      console.error("Error testing ElevenLabs voice:", error);
      res.status(500).json({ message: "Failed to test voice" });
    }
  });

  // Protected route to get user's banters
  app.get("/api/banters/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const requestedUserId = req.params.userId;
      const authenticatedUserId = req.user.id;
      
      // Users can only access their own banters
      if (requestedUserId !== authenticatedUserId && requestedUserId !== "demo-user") {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const limit = parseInt(req.query.limit as string) || 10;
      const banters = await storage.getBantersByUser(requestedUserId, limit);
      res.json(banters);
    } catch (error) {
      res.status(500).json({ message: "Failed to get banters" });
    }
  });

  // Protected route to get user settings
  app.get("/api/settings/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const requestedUserId = req.params.userId;
      const authenticatedUserId = req.user.id;
      
      // Users can only access their own settings
      if (requestedUserId !== authenticatedUserId && requestedUserId !== "demo-user") {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const settings = await storage.getUserSettings(requestedUserId);
      if (!settings) {
        return res.status(404).json({ message: "Settings not found" });
      }
      
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to get settings" });
    }
  });

  // Twitch API Endpoints
  
  // Get Twitch settings
  app.get("/api/twitch/:userId", isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.params;
      const settings = await storage.getTwitchSettings(userId);
      
      if (!settings) {
        return res.status(404).json({ message: "Twitch settings not found" });
      }
      
      // Don't expose tokens in response
      const { accessToken, refreshToken, ...safeSettings } = settings;
      res.json(safeSettings);
    } catch (error) {
      res.status(500).json({ message: "Failed to get Twitch settings" });
    }
  });

  // Discord settings endpoint
  app.get("/api/discord/:userId", isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.params;
      const settings = await storage.getDiscordSettings(userId);
      
      if (!settings) {
        return res.json({ isConnected: false });
      }
      
      // Don't expose tokens in response
      const { accessToken, refreshToken, ...safeSettings } = settings;
      res.json(safeSettings);
    } catch (error) {
      console.error('Error getting Discord settings:', error);
      res.status(500).json({ message: "Failed to get Discord settings" });
    }
  });

  // Test endpoint to manually create Discord connection (for debugging)
  app.post("/api/discord/:userId/test-connect", isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.params;
      console.log('Creating test Discord connection for user:', userId);
      
      const result = await storage.upsertDiscordSettings({
        userId,
        discordUserId: 'test_discord_user_' + Date.now(),
        discordUsername: 'TestUser#' + Math.floor(Math.random() * 9999),
        accessToken: 'test_access_token_' + Date.now(),
        isConnected: true,
        enabledEvents: ['discord_message', 'discord_member_join'],
      });
      
      console.log('Test Discord connection created successfully:', result.isConnected);
      res.json({ 
        success: true,
        message: "Test Discord connection created successfully", 
        isConnected: result.isConnected,
        discordUsername: result.discordUsername
      });
    } catch (error) {
      console.error('Error creating test Discord connection:', error);
      res.status(500).json({ message: "Failed to create test Discord connection", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Update Discord event settings
  app.put("/api/discord/:userId/events", isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.params;
      const { enabledEvents } = req.body;
      
      const settings = await storage.updateDiscordEventSettings(userId, enabledEvents);
      if (!settings) {
        return res.status(404).json({ message: "Discord settings not found" });
      }
      
      res.json({ message: "Discord event settings updated successfully" });
    } catch (error) {
      console.error('Error updating Discord event settings:', error);
      res.status(500).json({ message: "Failed to update Discord event settings" });
    }
  });

  // Discord connect/disconnect
  app.post("/api/discord/:userId/connect", isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Get Discord settings to get the bot token
      const discordSettings = await storage.getDiscordSettings(userId);
      if (!discordSettings || !discordSettings.accessToken) {
        return res.status(400).json({ message: "Discord not properly authenticated" });
      }
      
      // Create Discord client with config
      const discordService = new DiscordService({
        token: discordSettings.accessToken,
        clientId: process.env.DISCORD_CLIENT_ID || '',
        clientSecret: process.env.DISCORD_CLIENT_SECRET || ''
      });
      
      await discordService.connect();
      
      // Store in active connections
      discordClients.set(userId, discordService);
      
      res.json({ message: "Discord connected successfully" });
    } catch (error) {
      console.error('Error connecting Discord:', error);
      res.status(500).json({ message: "Failed to connect Discord" });
    }
  });

  app.post("/api/discord/:userId/disconnect", isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.params;
      
      const discordClient = discordClients.get(userId);
      if (discordClient) {
        await discordClient.disconnect();
        discordClients.delete(userId);
      }
      
      res.json({ message: "Discord disconnected successfully" });
    } catch (error) {
      console.error('Error disconnecting Discord:', error);
      res.status(500).json({ message: "Failed to disconnect Discord" });
    }
  });

  // Connect to Twitch
  app.post("/api/twitch/:userId/connect", isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.params;
      const { accessToken, refreshToken, twitchUsername, twitchUserId } = req.body;
      
      if (!accessToken || !twitchUsername || !twitchUserId) {
        return res.status(400).json({ message: "Missing required Twitch connection data" });
      }

      // Save Twitch settings
      const settings = await storage.upsertTwitchSettings({
        userId,
        accessToken,
        refreshToken,
        twitchUsername,
        twitchUserId,
        isConnected: true,
        enabledEvents: ['chat', 'subscribe', 'cheer', 'raid', 'follow']
      });

      // Initialize Twitch EventSub client
      const twitchClient = new TwitchEventSubClient(accessToken);
      twitchClient.setBanterGenerationCallback(generateBanterFromTwitchEvent);
      
      // Store the client for this user
      twitchClients.set(userId, twitchClient);
      
      // Connect to Twitch
      await twitchClient.connect();

      const { accessToken: _, refreshToken: __, ...safeSettings } = settings;
      res.json(safeSettings);
    } catch (error) {
      console.error("Error connecting to Twitch:", error);
      res.status(500).json({ message: "Failed to connect to Twitch" });
    }
  });

  // Disconnect from Twitch
  app.post("/api/twitch/:userId/disconnect", isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Disconnect the client if exists
      const twitchClient = twitchClients.get(userId);
      if (twitchClient) {
        await twitchClient.disconnect();
        twitchClients.delete(userId);
      }

      // Update settings to disconnected
      const settings = await storage.updateTwitchEventSettings(userId, []);
      if (settings) {
        await storage.upsertTwitchSettings({
          ...settings,
          isConnected: false,
          accessToken: null,
          refreshToken: null
        });
      }

      res.json({ success: true, message: "Disconnected from Twitch" });
    } catch (error) {
      console.error("Error disconnecting from Twitch:", error);
      res.status(500).json({ message: "Failed to disconnect from Twitch" });
    }
  });

  // Update Twitch event settings
  app.put("/api/twitch/:userId/events", isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.params;
      const { enabledEvents } = req.body;
      
      if (!Array.isArray(enabledEvents)) {
        return res.status(400).json({ message: "enabledEvents must be an array" });
      }

      const settings = await storage.updateTwitchEventSettings(userId, enabledEvents);
      if (!settings) {
        return res.status(404).json({ message: "Twitch settings not found" });
      }

      // Update the active client if connected
      const twitchClient = twitchClients.get(userId);
      if (twitchClient && settings.isConnected) {
        // Reconnect with new event settings
        await twitchClient.disconnect();
        await twitchClient.connect();
      }

      const { accessToken, refreshToken, ...safeSettings } = settings;
      res.json(safeSettings);
    } catch (error) {
      console.error("Error updating Twitch events:", error);
      res.status(500).json({ message: "Failed to update Twitch events" });
    }
  });

  // Register Discord slash commands on startup
  try {
    await registerCommands();
  } catch (error) {
    console.error('Failed to register Discord commands:', error);
  }
  
  // Initialize global Discord service for bot operations
  if (process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_CLIENT_ID) {
    globalDiscordService = new DiscordService({
      token: process.env.DISCORD_BOT_TOKEN,
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
    });
    
    globalDiscordService.setBanterCallback(generateBanterFromDiscordEvent);
    await globalDiscordService.connect();
    console.log('Global Discord service initialized for voice channel operations');
    
    // Set the service in slash command handler
    const { setDiscordService } = await import('./discord/slash');
    setDiscordService(globalDiscordService);
    
    console.log('Global Discord service initialized for voice channel operations');
  }

  return httpServer;
        }
