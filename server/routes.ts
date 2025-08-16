import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { join } from "path";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { ObjectStorageService } from "./objectStorage";
import { insertBanterItemSchema, insertUserSettingsSchema, type EventType, type EventData, guildLinks, users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { randomUUID } from "node:crypto";
import { setupGoogleAuth, isAuthenticated } from "./googleAuth";
import { setupLocalAuth } from "./localAuth";
import { setupTwitchAuth } from "./twitchAuth";
import { setupDiscordAuth } from "./discordAuth";
import discordInteractions from "./discord/interactions";
import { registerCommands, getBotInviteUrl } from "./discord/commands";
import TwitchEventSubClient from "./twitch";
import { DiscordService } from "./discord";
import OpenAI from "openai";
import { elevenLabsService } from "./elevenlabs";
import { ContextService } from "./contextService";

// Create OpenAI client with dynamic API key loading
const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }
  return new OpenAI({ apiKey });
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup Google authentication middleware
  await setupGoogleAuth(app);
  
  // Setup local authentication (email/password)
  await setupLocalAuth(app);
  
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

  // Generate banter using GPT with context memory
  async function generateBanter(eventType: EventType, eventData: EventData, originalMessage?: string, userId?: string, guildId?: string): Promise<string> {
    try {
      // Get user personality settings  
      let personalityContext = "You are a witty and clever banter bot. Make responses under 20 words with clever wordplay and humor.";
      
      if (userId) {
        try {
          const settings = await storage.getUserSettings(userId);
          const personality = settings?.banterPersonality || 'witty';
          const customPrompt = settings?.customPersonalityPrompt;

          if (personality === 'custom' && customPrompt) {
            personalityContext = customPrompt;
          } else {
            const personalityPrompts = {
              witty: "You are a witty and clever banter bot. Make responses under 25 words with clever wordplay and humor. NEVER mention specific usernames or reference other users by name.",
              friendly: "You are a friendly and warm banter bot. Use encouraging language and positive energy in your responses under 25 words. NEVER mention specific usernames or reference other users by name.",
              sarcastic: "You are a playfully sarcastic banter bot. Keep it fun, not mean. Use clever sarcasm and witty comebacks under 25 words. NEVER mention specific usernames or reference other users by name.",
              hype: "You are a high-energy hype bot! Use caps and exclamation points with explosive excitement under 25 words! NEVER mention specific usernames or reference other users by name.",
              chill: "You are a chill and laid-back banter bot. Keep responses relaxed, zen, and easygoing under 25 words. NEVER mention specific usernames or reference other users by name."
            };
            personalityContext = personalityPrompts[personality as keyof typeof personalityPrompts] || personalityPrompts.witty;
          }
        } catch (error) {
          console.log('Could not load user settings, using default personality');
        }
      }

      // Get context for more coherent responses
      let contextPrompt = '';
      if (userId) {
        try {
          contextPrompt = await ContextService.getContextForBanter(userId, eventType, guildId);
        } catch (error) {
          console.log('Could not load context, using default generation');
        }
      }

      let prompt = "";
      const fullPersonalityContext = `${personalityContext}\n\nCRITICAL RULE: Do NOT mention any usernames like "Nyn", "The Bard", or any other specific users. Focus only on the current message.`;
      
      switch (eventType) {
        case 'chat':
        case 'discord_message':
          prompt = `${fullPersonalityContext}\n\nRespond to this chat message: "${originalMessage}"\n\nRemember: Do NOT reference any usernames or other users in your response.`;
          break;
        case 'subscription':
          prompt = `${fullPersonalityContext}\n\nCreate a response for a new subscriber.`;
          break;
        case 'donation':
          prompt = `${fullPersonalityContext}\n\nCreate a response for a $${eventData.amount} donation${eventData.message ? ` with message: "${eventData.message}"` : ''}.`;
          break;
        case 'raid':
          prompt = `${fullPersonalityContext}\n\nCreate a response for a raid with ${eventData.raiderCount} viewers.`;
          break;
        case 'discord_member_join':
          prompt = `${fullPersonalityContext}\n\nCreate a welcome response for a new Discord member: "${eventData.displayName}"`;
          break;
        case 'discord_reaction':
          prompt = `${fullPersonalityContext}\n\nCreate a response for someone reacting with ${eventData.emoji}`;
          break;
        default:
          prompt = `${fullPersonalityContext}\n\nRespond to this interaction: "${originalMessage}"`;
          break;
      }

      const openai = getOpenAIClient();
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "You are BanterBox, an AI that generates entertaining responses for live streamers. Keep responses engaging, fun, and under 25 words. Match the personality and energy requested. IMPORTANT: Never mention specific usernames or reference other users by name. Focus only on the current message/event."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 100,
        temperature: 0.9,
      });

      const banterText = response.choices[0].message.content || getSmartFallback(eventType, eventData, originalMessage);
      
      // Record the event and successful banter in context memory
      if (userId) {
        try {
          // Record the original event
          await ContextService.recordEvent(userId, eventType, eventData, guildId);
          
          // Record successful banter generation if AI response was used
          if (response.choices[0].message.content) {
            await ContextService.recordBanterSuccess(userId, eventType, eventData, banterText, guildId);
          }
        } catch (error) {
          console.log('Could not record context:', error);
        }
      }
      
      return banterText;
    } catch (error) {
      console.error('Error generating banter:', error);
      
      // Still record the event even if AI fails
      if (userId) {
        try {
          await ContextService.recordEvent(userId, eventType, eventData, guildId, 1);
        } catch (error) {
          console.log('Could not record context for fallback:', error);
        }
      }
      
      return getSmartFallback(eventType, eventData, originalMessage);
    }
  }

  // Smart fallback responses when AI is unavailable
  function getSmartFallback(eventType: EventType, eventData: EventData, originalMessage?: string): string {
    const fallbacks = {
      chat: [
        "Great point in chat!",
        "Love the energy today!",
        "Chat's on fire! 🔥",
        "Thanks for keeping it lively!",
        "Always bringing the good vibes!"
      ],
      subscription: [
        "Welcome to the family! 🎉",
        "Another legend joins the crew!",
        "This community keeps growing!",
        "So grateful for the support!",
        "Let's gooooo! New sub hype!"
      ],
      donation: [
        `Wow, $${eventData?.amount || 'that'} donation! Incredible generosity!`,
        "The support means everything!",
        "This community is amazing!",
        "Blown away by your kindness!",
        "You're keeping the stream alive!"
      ],
      raid: [
        `${eventData?.raiderCount || 'Raiders'} strong! Welcome everyone!`,
        "What an epic raid! Thank you!",
        "The cavalry has arrived!",
        "This energy is unmatched!",
        "Welcome to the chaos, raiders!"
      ],
      follow: [
        "Welcome to the journey!",
        "Another awesome person joins!",
        "Growing stronger every day!",
        "Appreciate the follow!",
        "Let's make some memories!"
      ],
      discord_message: [
        "Discord gang staying active!",
        "Love the Discord engagement!",
        "Community vibes strong!",
        "Thanks for the Discord love!",
        "Bridge crew reporting in!"
      ],
      discord_member_join: [
        `Welcome ${eventData?.displayName || 'friend'} to Discord!`,
        "Discord family grows!",
        "New Discord legend unlocked!",
        "Community getting stronger!",
        "Welcome to the Discord crew!"
      ],
      discord_reaction: [
        "Discord reactions = instant feedback!",
        "Love the Discord interaction!",
        "Reactions speak louder than words!",
        "Discord crew showing love!",
        "Thanks for the emoji energy!"
      ]
    };

    const eventFallbacks = fallbacks[eventType] || fallbacks.chat;
    return eventFallbacks[Math.floor(Math.random() * eventFallbacks.length)];
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
      
      // Get user settings for voice preferences
      const userSettings = await storage.getUserSettings(userId);
      const voiceProvider = userSettings?.voiceProvider || 'openai';
      const voiceId = userSettings?.voiceId;
      
      let audioUrl: string | null = null;
      
      // Generate audio for all users (OpenAI TTS by default, ElevenLabs for pro users if configured)
      try {
        const audioBuffer = await generateTTS(banterText, userId);
        if (audioBuffer) {
          // Save audio to object storage and get URL
          audioUrl = await objectStorage.saveAudioFile(audioBuffer);
        }
      } catch (audioError) {
        console.error("Error generating audio:", audioError);
        // Continue without audio if generation fails
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
        const openai = getOpenAIClient();
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
        const openai = getOpenAIClient();
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
  async function generateBanterFromDiscordEvent(discordUserId: string | null, originalMessage: string, eventType: string, eventData: any) {
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
      
      const banterText = await generateBanter(eventTypeForBanter, eventData, originalMessage, workspaceUserId);
      
      // Always generate TTS audio for banters (for dashboard playback)
      let audioUrl = null;
      
      console.log(`Generating audio for Discord banter`);
      console.log(`globalDiscordService available: ${!!globalDiscordService}`);
      const isInVoiceChannel = globalDiscordService?.isInVoiceChannel(eventData.guildId);
      console.log(`Bot in voice channel for guild ${eventData.guildId}: ${isInVoiceChannel}`);
      
      // Always generate audio for dashboard playback (regardless of voice channel status)
      try {
        console.log(`Generating audio - voice channel check bypassed for dashboard playback`);
        // Use guild settings for Discord, not user settings
        if (guildSettings?.voiceProvider === 'elevenlabs') {
          console.log(`Using ElevenLabs for audio generation`);
          const voiceId = elevenLabsService.getDefaultVoice();
          const audioBuffer = await elevenLabsService.generateSpeech(banterText, voiceId);
          if (audioBuffer) {
            audioUrl = await objectStorage.saveAudioFile(audioBuffer);
            console.log(`ElevenLabs audio saved with URL: ${audioUrl}`);
          }
        } else {
          // Use OpenAI TTS (default)
          console.log(`Using OpenAI TTS for audio generation`);
          const openai = getOpenAIClient();
          const response = await openai.audio.speech.create({
            model: "tts-1",
            voice: "alloy",
            input: banterText,
          });
          const audioBuffer = Buffer.from(await response.arrayBuffer());
          audioUrl = await objectStorage.saveAudioFile(audioBuffer);
          console.log(`OpenAI audio saved with URL: ${audioUrl}`);
        }
        console.log(`Generated Discord banter with audio for ${eventType}: "${banterText}"`);
        console.log(`Audio URL generated: ${audioUrl}`);
        console.log(`Global Discord Service available: ${!!globalDiscordService}`);
        
        // Play the audio in Discord voice channel if bot is connected
        if (audioUrl && globalDiscordService && isInVoiceChannel) {
            // Use the public object URL instead of localhost - Discord needs external access
            const replicationDomain = process.env.REPLIT_DOMAINS?.split(',')[0];
            console.log(`REPLIT_DOMAINS env var: ${process.env.REPLIT_DOMAINS}`);
            console.log(`Parsed domain: ${replicationDomain}`);
            
            const publicAudioUrl = replicationDomain 
              ? `https://${replicationDomain}${audioUrl}`
              : `http://localhost:5000${audioUrl}`;
            
            console.log(`Attempting to play audio in Discord: ${publicAudioUrl}`);
            
            // Test URL accessibility before trying to play
            try {
              const testResponse = await fetch(publicAudioUrl);
              console.log(`Audio URL test - Status: ${testResponse.status}, Accessible: ${testResponse.ok}`);
            } catch (error) {
              console.log(`Audio URL not accessible:`, error instanceof Error ? error.message : String(error));
            }
            
            try {
              const playbackResult = await globalDiscordService.playAudioInVoiceChannel(eventData.guildId, publicAudioUrl);
              console.log(`Audio playback result: ${playbackResult}`);
            } catch (error) {
              console.error(`Error playing audio in Discord:`, error);
            }
          } else {
            console.log(`Skipping Discord audio playback - not in voice channel`);
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
  
  // Serve audio files from filesystem when object storage isn't available
  app.use('/audio', express.static(join(process.cwd(), 'public/audio')));
  
  // Health check endpoint for offline detection
  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
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
  
  // Serve public audio files
  app.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    
    // Add CORS headers for audio files to enable cross-origin access
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Range");
    res.header("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Encoding, Content-Length");
    
    try {
      const file = await objectStorage.searchPublicObject(filePath);
      if (!file) {
        console.log(`Audio file not found: ${filePath}`);
        return res.status(404).json({ 
          error: "Audio file not found",
          message: "This audio file may have been created in a different environment. Please generate new banters to create audio files.",
          path: filePath 
        });
      }
      objectStorage.downloadObject(file, res);
    } catch (error) {
      console.error("Error serving audio file:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Check if it's an object storage configuration issue
      if (errorMessage.includes('PUBLIC_OBJECT_SEARCH_PATHS')) {
        return res.status(503).json({ 
          error: "Object storage not configured",
          message: "The server's object storage is not properly configured. Please ensure environment variables are set.",
          details: errorMessage
        });
      }
      
      return res.status(500).json({ 
        error: "Internal server error",
        message: "Failed to retrieve audio file from storage",
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      });
    }
  });
  
  // Get user settings (return defaults if none exist)
  app.get("/api/settings/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      let settings = await storage.getUserSettings(userId);
      
      // If no settings exist, return default settings
      if (!settings) {
        const defaultSettings = {
          userId,
          personality: 'witty',
          voiceId: '21m00Tcm4TlvDq8ikWAM',
          voiceSpeed: 1.0,
          voiceStability: 0.5,
          voiceSimilarityBoost: 0.8,
          customPersonality: '',
          enabledEvents: ['chat', 'subscription', 'donation', 'raid', 'follow'],
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        // Create and save the default settings
        settings = await storage.createUserSettings(defaultSettings);
      }
      
      res.json(settings);
    } catch (error) {
      console.error('Error getting settings:', error);
      res.status(500).json({ message: "Failed to get settings" });
    }
  });

  // Update user settings (create if don't exist)
  app.put("/api/settings/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const updates = req.body;
      
      // Try to update existing settings first
      let updated = await storage.updateUserSettings(userId, updates);
      
      // If settings don't exist, create them with the updates
      if (!updated) {
        const defaultSettings = {
          userId,
          personality: 'witty',
          voiceId: '21m00Tcm4TlvDq8ikWAM',
          voiceSpeed: 1.0,
          voiceStability: 0.5,
          voiceSimilarityBoost: 0.8,
          customPersonality: '',
          enabledEvents: ['chat', 'subscription', 'donation', 'raid', 'follow'],
          ...updates // Apply the requested updates on top of defaults
        };
        
        updated = await storage.createUserSettings(defaultSettings);
      }
      
      res.json(updated);
    } catch (error) {
      console.error('Error updating/creating settings:', error);
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

  // Marketplace endpoints

  // Get marketplace personalities
  app.get("/api/marketplace/personalities", async (req, res) => {
    try {
      const { category, sortBy, limit } = req.query;
      const personalities = await storage.getMarketplacePersonalities(
        category as string,
        (sortBy as 'popular' | 'recent' | 'trending') || 'popular',
        parseInt(limit as string) || 20
      );
      res.json(personalities);
    } catch (error) {
      console.error('Error getting marketplace personalities:', error);
      res.status(500).json({ message: "Failed to get marketplace personalities" });
    }
  });

  // Get personality by ID
  app.get("/api/marketplace/personalities/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const personality = await storage.getPersonalityById(id);
      if (!personality) {
        return res.status(404).json({ message: "Personality not found" });
      }
      res.json(personality);
    } catch (error) {
      console.error('Error getting personality:', error);
      res.status(500).json({ message: "Failed to get personality" });
    }
  });

  // Create marketplace personality
  app.post("/api/marketplace/personalities", async (req, res) => {
    try {
      const personalityData = req.body;
      
      // Get author info from authenticated user or use demo for testing
      const user = req.user as any;
      personalityData.authorId = user?.id || "demo-user";
      personalityData.authorName = user?.name || user?.email || "Demo User";
      
      const personality = await storage.createMarketplacePersonality(personalityData);
      res.status(201).json(personality);
    } catch (error) {
      console.error('Error creating personality:', error);
      res.status(500).json({ message: "Failed to create personality" });
    }
  });

  // Vote on personality
  app.post("/api/marketplace/personalities/:id/vote", async (req, res) => {
    try {
      const { id } = req.params;
      const { voteType } = req.body;
      const userId = "demo-user"; // In real app, get from auth
      
      if (!['upvote', 'downvote'].includes(voteType)) {
        return res.status(400).json({ message: "Invalid vote type" });
      }

      const vote = await storage.voteOnPersonality({
        personalityId: id,
        userId,
        voteType
      });
      
      res.json(vote);
    } catch (error) {
      console.error('Error voting on personality:', error);
      res.status(500).json({ message: "Failed to vote on personality" });
    }
  });

  // Download personality
  app.post("/api/marketplace/personalities/:id/download", async (req, res) => {
    try {
      const { id } = req.params;
      const userId = "demo-user"; // In real app, get from auth
      
      const personality = await storage.getPersonalityById(id);
      if (!personality) {
        return res.status(404).json({ message: "Personality not found" });
      }

      const download = await storage.downloadPersonality({
        personalityId: id,
        userId
      });
      
      res.json({ 
        download,
        personality: {
          name: personality.name,
          prompt: personality.prompt,
          description: personality.description
        }
      });
    } catch (error) {
      console.error('Error downloading personality:', error);
      res.status(500).json({ message: "Failed to download personality" });
    }
  });

  // Search personalities
  app.get("/api/marketplace/search", async (req, res) => {
    try {
      const { q, category } = req.query;
      if (!q) {
        return res.status(400).json({ message: "Search query required" });
      }
      
      const personalities = await storage.searchPersonalities(q as string, category as string);
      res.json(personalities);
    } catch (error) {
      console.error('Error searching personalities:', error);
      res.status(500).json({ message: "Failed to search personalities" });
    }
  });

  // Voice Marketplace API Endpoints
  
  // Get marketplace voices
  app.get("/api/marketplace/voices", async (req, res) => {
    try {
      const { category, sortBy, limit } = req.query;
      const voices = await storage.getMarketplaceVoices(
        category as string,
        (sortBy as 'popular' | 'recent' | 'downloads') || 'recent',
        parseInt(limit as string) || 20
      );
      res.json(voices);
    } catch (error) {
      console.error('Error getting marketplace voices:', error);
      res.status(500).json({ message: "Failed to get marketplace voices" });
    }
  });

  // Get specific marketplace voice
  app.get("/api/marketplace/voices/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const voice = await storage.getMarketplaceVoiceById(id);
      if (!voice) {
        return res.status(404).json({ message: "Voice not found" });
      }
      res.json(voice);
    } catch (error) {
      console.error('Error getting marketplace voice:', error);
      res.status(500).json({ message: "Failed to get marketplace voice" });
    }
  });

  // Download marketplace voice
  app.post("/api/marketplace/voices/:id/download", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      const voice = await storage.getMarketplaceVoiceById(id);
      if (!voice) {
        return res.status(404).json({ message: "Voice not found" });
      }

      // Add to user's custom voices
      await storage.saveCustomVoice({
        userId,
        name: `${voice.name} (Downloaded)`,
        baseVoiceId: voice.baseVoiceId,
        settings: typeof voice.settings === 'string' ? voice.settings : JSON.stringify(voice.settings)
      });

      // Increment download count
      await storage.incrementVoiceDownloads(id);

      res.json({ message: "Voice downloaded successfully" });
    } catch (error) {
      console.error('Error downloading voice:', error);
      res.status(500).json({ message: "Failed to download voice" });
    }
  });

  // Search marketplace voices
  app.get("/api/marketplace/voices/search", async (req, res) => {
    try {
      const { q, category } = req.query;
      if (!q) {
        return res.status(400).json({ message: "Search query required" });
      }
      
      const voices = await storage.searchMarketplaceVoices(q as string, category as string);
      res.json(voices);
    } catch (error) {
      console.error('Error searching marketplace voices:', error);
      res.status(500).json({ message: "Failed to search marketplace voices" });
    }
  });

  // Content Moderation API for Personality Builder
  app.post('/api/personality/moderate', async (req, res) => {
    try {
      const { content } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: 'Content is required' });
      }

      // Simple content moderation
      const flaggedContent = {
        harmful: ['suicide', 'kill yourself', 'end your life', 'hurt yourself', 'self harm'],
        sexual: ['sexual', 'nsfw', 'explicit', 'adult content', 'porn', 'sex'],
        harassment: ['hate', 'racist', 'sexist', 'bully', 'harass', 'nazi', 'fascist'],
        inappropriate: ['illegal', 'drugs', 'violence against', 'harm others', 'murder', 'terrorist']
      };

      const issues: string[] = [];
      const lowerContent = content.toLowerCase();
      
      Object.entries(flaggedContent).forEach(([category, keywords]) => {
        keywords.forEach(keyword => {
          if (lowerContent.includes(keyword)) {
            issues.push(`Contains ${category} content: "${keyword}"`);
          }
        });
      });

      const passed = issues.length === 0;
      
      res.json({ 
        passed, 
        issues,
        content: passed ? 'Content approved' : 'Content requires review'
      });
    } catch (error) {
      console.error('Content moderation error:', error);
      res.status(500).json({ error: 'Failed to moderate content' });
    }
  });

  // Test personality endpoint for personality builder
  app.post('/api/personality/test', async (req, res) => {
    try {
      const { personality, prompt, message } = req.body;
      
      // For debugging - return the debug info if requested
      if (req.query.debug === 'true') {
        return res.json({
          debug: {
            receivedBody: req.body,
            personality,
            prompt,
            message,
            messageType: typeof message
          }
        });
      }
      
      // Use prompt from either direct prompt field or personality object
      const personalityPrompt = prompt || (personality && personality.prompt);
      
      if (!personalityPrompt || !message) {
        return res.status(400).json({ error: 'Personality prompt and message are required' });
      }

      // Ensure message is always a string and handle the object issue
      let messageStr;
      if (typeof message === 'string') {
        messageStr = message;
      } else if (typeof message === 'object' && message !== null) {
        // If it's an object, try to extract meaningful content
        messageStr = message.text || message.content || message.message || JSON.stringify(message);
      } else {
        messageStr = String(message);
      }
      
      try {
        // Call OpenAI directly for personality testing
        const openaiClient = getOpenAIClient();
        const response = await openaiClient.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: personalityPrompt + '\n\nKeep responses under 25 words. Be engaging and match the personality style.'
            },
            {
              role: 'user',
              content: `React to this stream event: "${messageStr}"`
            }
          ],
          max_tokens: 100,
          temperature: 0.8,
        });

        const banterText = response.choices[0]?.message?.content?.trim() || 'Something witty to say about that!';
        res.json({ banterText });
      } catch (error) {
        console.error('AI generation failed:', error);
        
        // Return error info in response for debugging
        if (req.query.debug === 'true') {
          return res.json({ 
            error: true,
            type: error instanceof Error ? error.constructor.name : 'Unknown',
            message: error instanceof Error ? error.message : 'Unknown error',
            banterText: 'Debug: AI call failed'
          });
        }
        
        // Fallback response if AI fails
        const fallbackResponses = [
          "Looking good on stream today!",
          "Thanks for the great energy everyone!",
          "What an awesome moment!",
          "The chat is really bringing the vibes tonight!",
          "Can't wait to see what happens next!"
        ];
        
        const randomResponse = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
        res.json({ banterText: randomResponse });
      }
    } catch (error) {
      console.error('Personality test error:', error);
      res.status(500).json({ error: 'Failed to test personality' });
    }
  });

  // Get user's personalities
  app.get("/api/marketplace/my-personalities", async (req, res) => {
    try {
      const userId = "demo-user"; // In real app, get from auth
      const personalities = await storage.getUserPersonalities(userId);
      res.json(personalities);
    } catch (error) {
      console.error('Error getting user personalities:', error);
      res.status(500).json({ message: "Failed to get user personalities" });
    }
  });

  // Get context memory summary
  app.get("/api/context/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const { guildId } = req.query;
      
      const [recentContext, activitySummary] = await Promise.all([
        storage.getRecentContext(userId, guildId as string, 10),
        ContextService.getStreamActivitySummary(userId, guildId as string)
      ]);
      
      res.json({
        recentContext,
        activitySummary,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error getting context:', error);
      res.status(500).json({ message: "Failed to get context" });
    }
  });

  // Test context memory system
  app.post("/api/test/context", async (req, res) => {
    try {
      const userId = "demo-user";
      
      // Ensure demo user exists first
      let user = await storage.getUser(userId);
      if (!user) {
        user = await storage.upsertUser({
          id: userId,
          email: "demo@example.com",
          firstName: "Demo",
          lastName: "Streamer",
          isPro: true,
          hasCompletedOnboarding: true
        });
        console.log('Created demo user:', user);
      }
      
      // Generate some sample context events
      await ContextService.recordEvent(userId, 'chat', { 
        username: 'TestViewer1', 
        message: 'Hey streamer, how are you today?' 
      }, undefined, 3);
      
      await ContextService.recordEvent(userId, 'donation', {
        username: 'GenerousViewer',
        amount: 25,
        message: 'Keep up the great work!'
      }, undefined, 7);
      
      await ContextService.recordEvent(userId, 'raid', {
        username: 'FriendlyStreamer',
        raiderCount: 15
      }, undefined, 5);
      
      // Now generate banter that should use this context
      const contextualBanter = await generateBanter(
        'chat',
        { username: 'NewViewer', message: 'What did I miss?' },
        'What did I miss?',
        userId
      );
      
      res.json({
        message: "Context memory test completed",
        contextualBanter,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Context test error:', error);
      res.status(500).json({ message: "Context test failed" });
    }
  });

  // Test personality endpoint
  app.post("/api/test/personality", async (req, res) => {
    try {
      const { message, personality } = req.body;
      
      // Create a test settings object with the specified personality
      const testSettings = {
        id: 'test-settings',
        userId: 'test-user',
        voiceProvider: 'openai',
        voiceId: null,
        autoPlay: true,
        volume: 75,
        enabledEvents: ['chat'],
        overlayPosition: 'bottom-center',
        overlayDuration: 12,
        overlayAnimation: 'fade',
        banterPersonality: personality || 'witty',
        customPersonalityPrompt: null,
        updatedAt: new Date(),
      };
      
      // Temporarily override storage.getUserSettings for this test
      const originalGetUserSettings = storage.getUserSettings;
      storage.getUserSettings = async () => testSettings;
      
      try {
        const banterText = await generateBanter('chat', { username: 'TestUser' }, message, 'test-user');
        
        // Restore original function
        storage.getUserSettings = originalGetUserSettings;
        
        res.json({ 
          personality,
          message,
          banterText,
          timestamp: new Date()
        });
      } catch (error) {
        // Restore original function in case of error
        storage.getUserSettings = originalGetUserSettings;
        throw error;
      }
    } catch (error) {
      console.error('Error testing personality:', error);
      res.status(500).json({ message: "Failed to test personality" });
    }
  });

  // Generate new banter
  app.post("/api/banter/generate", async (req, res) => {
    try {
      const { userId, eventType, eventData, originalMessage } = req.body;
      
      // Check daily usage limits only if userId is provided
      if (userId) {
        const usageCheck = await storage.checkAndIncrementDailyUsage(userId);
        if (!usageCheck.allowed) {
          return res.status(429).json({ 
            message: `Daily limit reached. You've used ${usageCheck.current} of ${usageCheck.limit} banters today.`,
            usage: usageCheck,
            upgrade: !usageCheck.isPro ? "Upgrade to Pro for unlimited banters!" : null
          });
        }
      }
      
      // Generate banter text with user personality
      const banterText = await generateBanter(eventType, eventData, originalMessage, userId);
      
      // Create banter item (skip database storage for testing without userId)
      let banterItem;
      if (userId) {
        banterItem = await storage.createBanterItem({
          userId,
          originalMessage,
          banterText,
          eventType,
          eventData,
          isPlayed: false,
        });
      } else {
        // Create a temporary banter item for testing
        banterItem = {
          id: `test-${Date.now()}`,
          userId: null,
          originalMessage,
          banterText,
          eventType,
          eventData,
          audioUrl: null,
          isPlayed: false,
          createdAt: new Date()
        };
      }

      // Generate TTS audio
      try {
        const audioBuffer = await generateTTS(banterText, userId);
        if (audioBuffer) {
          // Save audio to object storage
          const audioUrl = await objectStorage.saveAudioFile(audioBuffer);
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
      const userId = (req.user as any)?.id;
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
      const authenticatedUserId = (req.user as any)?.id;
      
      // Ensure user can only access their own data
      if (userId !== authenticatedUserId) {
        return res.status(403).json({ message: "Access denied" });
      }
  
      // Find all guild links for this workspace
      const allGuildLinks = await db.select().from(guildLinks).where(eq(guildLinks.workspaceId, userId));
      const activeGuildLinks = allGuildLinks.filter(link => link.active);
  
      res.json({
        isConnected: activeGuildLinks.length > 0,
        connectedGuilds: activeGuildLinks.length,
        guilds: activeGuildLinks.map(link => ({
          guildId: link.guildId,
          linkedByUserId: link.linkedByUserId,
          createdAt: link.createdAt,
        }))
      });
    } catch (error) {
      console.error('Error getting Discord status:', error);
      res.status(500).json({ message: "Failed to get Discord status" });
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
          const audioUrl = await objectStorage.saveAudioFile(audioBuffer);
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
          const audioUrl = await objectStorage.saveAudioFile(audioBuffer);
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
  // Make user pro endpoint (admin function)
  app.post('/api/auth/make-pro', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email required" });
      }
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Update user to pro
      const [updatedUser] = await db.update(users).set({ isPro: true }).where(eq(users.email, email)).returning();
      
      res.json({ message: `User ${email} is now a pro member!`, user: updatedUser });
    } catch (error) {
      console.error("Make pro error:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Set password for existing user (allows Google users to add local login)
  app.post('/api/auth/set-password', isAuthenticated, async (req, res) => {
    try {
      const { password } = req.body;
      const user = req.user as any;
      
      if (!password || password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }
      
      // Hash the password
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Update user with password
      await db.update(users).set({ password: hashedPassword }).where(eq(users.id, user.id));
      
      res.json({ message: "Password set successfully! You can now login with email/password." });
    } catch (error) {
      console.error("Set password error:", error);
      res.status(500).json({ message: "Failed to set password" });
    }
  });

  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user; // Google Auth stores the full user object
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
        enabledEvents: JSON.stringify(['discord_message', 'discord_member_join']),
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
        enabledEvents: JSON.stringify(['chat', 'subscribe', 'cheer', 'raid', 'follow'])
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
          userId: settings.userId,
          isConnected: false,
          accessToken: null,
          refreshToken: null,
          enabledEvents: Array.isArray(settings.enabledEvents) 
            ? JSON.stringify(settings.enabledEvents) 
            : settings.enabledEvents,
          twitchUsername: settings.twitchUsername,
          twitchUserId: settings.twitchUserId
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

  // TTS generation endpoint for marketplace examples
  app.post('/api/tts/generate', async (req, res) => {
    try {
      const { text, personality, voicePreference } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }

      // Clean text by removing emotional brackets for ElevenLabs
      const cleanText = text.replace(/\[.*?\]/g, '').trim();

      // Select appropriate voice based on personality and voice preference
      let voiceId = '21m00Tcm4TlvDq8ikWAM'; // Default Rachel voice
      
      // Comprehensive personality-to-voice mapping with unique voices
      const personalityVoiceMap: { [key: string]: { higher: string; lower: string } } = {
        'Gaming Hype Beast': { 
          higher: '21m00Tcm4TlvDq8ikWAM', // Rachel - clear, energetic female
          lower: 'yoZ06aMxZJJ28mfd3POQ'   // Sam - enthusiastic young male
        },
        'Sarcastic Roast Master': { 
          higher: 'cgSgspJ2msm6clMCkdW9', // Jessica - sharp female
          lower: 'ErXwobaYiN019PkySvjV'   // Antoni - witty, sophisticated male
        },
        'Chill Vibes Curator': { 
          higher: 'oWAxZDx7w5VEj9dCyTzz', // Grace - elegant, refined female
          lower: 'bVMeCyTHy58xNoL34h3p'   // Jeremy - smooth, relaxed male
        },
        'Music Stream Maestro': { 
          higher: 'AZnzlk1XvdvUeBnXmlld', // Domi - rich, expressive female
          lower: 'SOYHLrjzK2X1ezoPC6cr'   // Harry - casual, friendly male
        },
        'Study Buddy Scholar': { 
          higher: 'XrExE9yKIg1WjnnlVkGX', // Matilda - warm, educational female
          lower: 'pNInz6obpgDQGcFmaJgB'   // Adam - clear, professional narrator
        },
        'Wholesome Cheerleader': { 
          higher: 'ThT5KcBeYPX3keUQqHPh', // Dorothy - sweet, cheerful female
          lower: 'N2lVS1w4EtoT3dr4eOWO'   // Callum - young, energetic male
        },
        'Retro Gaming Guru': { 
          higher: 'EXAVITQu4vr4xnSDxMaL', // Bella - dynamic female gamer
          lower: 'IKne3meq5aSn9XLyUdCD'   // Charlie - British, sophisticated male
        },
        'Science Enthusiast': { 
          higher: 'MF3mGyEYCl7XYWbV9V6O', // Elli - gentle, encouraging female
          lower: 'TX3LPaxmHKxFdv7VOQHJ'   // Liam - confident, clear male
        },
        'Midnight Café Host': { 
          higher: 'g5CIjZEefAph4nQFvHAz', // Sarah - warm, intimate female
          lower: 'flq6f7yk4E4fJM5XTYuZ'   // Michael - calm, soothing male
        },
        'Competitive Esports Analyst': { 
          higher: 'EXAVITQu4vr4xnSDxMaL', // Bella - dynamic female gamer
          lower: 'JBFqnCBsd6RMkjVDRZzb'   // George - deep, authoritative male
        },
        'Creative Art Mentor': { 
          higher: 'XrExE9yKIg1WjnnlVkGX', // Matilda - warm, educational female
          lower: 'TX3LPaxmHKxFdv7VOQHJ'   // Liam - confident, clear male
        },
        'Horror Story Narrator': { 
          higher: 'AZnzlk1XvdvUeBnXmlld', // Domi - can be eerie female
          lower: 'VR6AewLTigWG4xSOukaG'   // Arnold - deep, ominous male
        },
        'Cooking Show Host': { 
          higher: 'XB0fDUnXU5powFXDhCwa', // Charlotte - enthusiastic, warm female
          lower: 'SOYHLrjzK2X1ezoPC6cr'   // Harry - casual, friendly male
        },
        'Zen Meditation Guide': { 
          higher: 'oWAxZDx7w5VEj9dCyTzz', // Grace - elegant, refined female
          lower: 'flq6f7yk4E4fJM5XTYuZ'   // Michael - calm, soothing male
        }
      };

      // Select voice based on exact personality match or fallback
      if (personality && personalityVoiceMap[personality]) {
        voiceId = voicePreference === 'higher' 
          ? personalityVoiceMap[personality].higher 
          : personalityVoiceMap[personality].lower;
      } else {
        // Fallback for unmapped personalities
        voiceId = voicePreference === 'higher' 
          ? '21m00Tcm4TlvDq8ikWAM'  // Rachel
          : 'pNInz6obpgDQGcFmaJgB'; // Adam
      }

      // Generate speech using ElevenLabs
      const audioBuffer = await elevenLabsService.generateSpeech(cleanText, voiceId);
      
      // Set appropriate headers for audio response
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
      });
      
      res.send(audioBuffer);
    } catch (error) {
      console.error('TTS generation error:', error);
      res.status(500).json({ error: 'Failed to generate audio' });
    }
  });

  // Voice Builder endpoints
  app.post('/api/voice-builder/preview', async (req, res) => {
    try {
      const { text, baseVoiceId, settings } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }

      // Clean text by removing emotional brackets for ElevenLabs
      const cleanText = text.replace(/\[.*?\]/g, '').trim();

      // Convert settings to ElevenLabs format
      const elevenLabsSettings = {
        stability: settings.stability / 100,
        similarity_boost: settings.similarityBoost / 100,
        style: settings.style / 100,
        use_speaker_boost: settings.useSpeakerBoost
      };

      // Generate speech using ElevenLabs with custom settings
      const audioBuffer = await elevenLabsService.generateSpeechWithSettings(
        cleanText, 
        baseVoiceId, 
        elevenLabsSettings
      );
      
      // Set appropriate headers for audio response
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
      });
      
      res.send(audioBuffer);
    } catch (error) {
      console.error('Voice builder preview error:', error);
      res.status(500).json({ error: 'Failed to generate voice preview' });
    }
  });

  app.post('/api/voice-builder/save', async (req, res) => {
    try {
      const { name, description, category, tags, baseVoiceId, settings, addToMarketplace, sampleText } = req.body;
      // Use a default user ID for testing when not authenticated  
      const user = req.user as any;
      const userId = user?.id || 'guest-user';
      
      if (!name || !baseVoiceId || !settings) {
        return res.status(400).json({ error: 'Name, base voice, and settings are required' });
      }

      if (addToMarketplace && (!description || !sampleText)) {
        return res.status(400).json({ error: 'Description and sample text are required for marketplace' });
      }

      if (addToMarketplace && (!tags || tags.length === 0)) {
        return res.status(400).json({ error: 'At least one tag is required for marketplace voices' });
      }

      // Save custom voice to user's library
      const customVoice = await storage.saveCustomVoice({
        userId,
        name,
        baseVoiceId,
        settings: JSON.stringify(settings)
      });

      let marketplaceVoice = null;
      if (addToMarketplace) {
        // Ensure "custom" tag is always included for user-generated voices
        const finalTags = tags.includes('custom') ? tags : [...tags, 'custom'];
        
        // Also add to voice marketplace
        marketplaceVoice = await storage.createVoiceMarketplace({
          authorId: userId,
          name,
          description,
          baseVoiceId,
          settings: JSON.stringify(settings),
          sampleText,
          category: category || 'Custom',
          tags: finalTags
        });
      }

      res.json({ 
        success: true, 
        message: addToMarketplace 
          ? `Custom voice "${name}" saved and added to marketplace!`
          : `Custom voice "${name}" saved successfully`,
        voiceId: customVoice.id,
        marketplaceId: marketplaceVoice?.id
      });
    } catch (error) {
      console.error('Voice builder save error:', error);
      res.status(500).json({ error: 'Failed to save custom voice' });
    }
  });

  app.get('/api/voice-builder/voices/:userId', isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Ensure user can only access their own voices
      const user = req.user as any;
      if (user?.id !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const customVoices = await storage.getCustomVoices(userId);
      res.json(customVoices);
    } catch (error) {
      console.error('Error fetching custom voices:', error);
      res.status(500).json({ error: 'Failed to fetch custom voices' });
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
