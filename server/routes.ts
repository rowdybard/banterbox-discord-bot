import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { ObjectStorageService } from "./objectStorage";
import { firebaseStorage } from "./firebase";
import { insertBanterItemSchema, insertUserSettingsSchema, type EventType, type EventData, guildLinks, linkCodes, discordSettings, users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { getTierConfig } from "@shared/billing";
import type { SubscriptionTier } from "@shared/types";
import { isProUser, getSubscriptionInfo } from "@shared/subscription";
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
import { FirebaseContextService } from "./firebaseContextService";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR
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
    
    // Use Array.from() to avoid modifying Set during iteration
    const clientsToRemove: WebSocket[] = [];
    Array.from(clients).forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
        console.log('Message sent to client');
      } else {
        console.log('Client not ready, marking for removal');
        clientsToRemove.push(client);
      }
    });
    
    // Remove closed clients after iteration
    clientsToRemove.forEach(client => {
      clients.delete(client);
    });
  }

  // Generate banter using GPT
  async function generateBanter(eventType: EventType, eventData: EventData, originalMessage?: string, userId?: string, guildId?: string): Promise<string> {
    try {
      // Get personality settings from web dashboard (source of truth)
      let personalityContext = "Be conversational and natural. Keep responses under 25 words. Be creative and varied in your responses.";
      
      // Always use user settings from web dashboard for personality
      if (userId) {
        try {
          const settings = await storage.getUserSettings(userId);
          console.log(`DEBUG: Fetched settings for user ${userId}:`, {
            banterPersonality: settings?.banterPersonality,
            customPersonalityPrompt: settings?.customPersonalityPrompt ? 'Has custom prompt' : 'No custom prompt',
            voiceProvider: settings?.voiceProvider,
            voiceId: settings?.voiceId
          });
          
          // Log the actual custom prompt content for debugging
          if (settings?.customPersonalityPrompt) {
            console.log(`DEBUG: Custom personality prompt content: "${settings.customPersonalityPrompt.substring(0, 200)}..."`);
          }
          
          const personality = settings?.banterPersonality || 'context';
          const customPrompt = settings?.customPersonalityPrompt;

          if (personality === 'custom' && customPrompt) {
            // Enhance short custom prompts to be more descriptive
            if (customPrompt.length < 50) {
              // If it's a short prompt like "college bro", expand it
              if (customPrompt.toLowerCase().includes('college bro') || customPrompt.toLowerCase().includes('gig economy')) {
                personalityContext = "You're a typical college bro who's knowledgeable about the gig economy. Be casual, confident, and use modern slang. Talk about side hustles, delivery apps, freelancing, and student life. Keep responses under 25 words. Be energetic and relatable to young people. Use phrases like 'bro', 'dude', 'that's fire', 'no cap', etc. naturally.";
                console.log(`DEBUG: Enhanced short custom prompt for user ${userId}`);
              } else {
                personalityContext = customPrompt;
                console.log(`DEBUG: Using custom personality prompt for user ${userId}`);
              }
            } else {
              personalityContext = customPrompt;
              console.log(`DEBUG: Using custom personality prompt for user ${userId}`);
            }
          } else if (personality.startsWith('favorite_') && customPrompt) {
            // Use custom prompt for favorite personalities
            personalityContext = customPrompt;
            console.log(`DEBUG: Using favorite personality prompt for user ${userId}`);
          } else {
            const personalityPrompts = {
              witty: "Be witty and clever with natural wordplay and humor. Keep responses under 25 words. Be creative and avoid repetition.",
              friendly: "Be warm and encouraging with positive energy. Respond naturally and supportively. Show genuine interest and vary your responses.",
              sarcastic: "Be playfully sarcastic but fun, not mean. Use clever sarcasm and natural comebacks. Mix up your sarcastic style.",
              hype: "BE HIGH-ENERGY! Use caps and exclamation points! GET EVERYONE PUMPED UP! Vary your hype energy levels.",
              chill: "Stay relaxed and laid-back. Keep responses natural, zen, and easygoing. Mix up your chill vibes.",
              context: "Be context-aware and reference conversation history naturally. Use previous interactions and ongoing topics to create more relevant responses. Keep responses under 25 words. Make connections to past events when appropriate.",
              roast: "Be playfully roasting and teasing. Use clever burns that are funny, not hurtful. Vary your roasting style."
            };
            personalityContext = personalityPrompts[personality as keyof typeof personalityPrompts] || personalityPrompts.context;
            console.log(`DEBUG: Using preset personality: ${personality} for user ${userId}`);
          }
          console.log(`Using web dashboard personality: ${personality} for user ${userId}`);
        } catch (error) {
          console.log('Could not load user settings, using default personality:', error);
        }
      } else {
        console.log('DEBUG: No userId provided to generateBanter, using default personality');
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
      
      // Add context to prompt if available - make it feel more natural
      if (contextString) {
        prompt = `${personalityContext}\n\n${contextString}\n\n`;
        console.log(`DEBUG: Using personality + context for user ${userId}`);
      } else {
        prompt = `${personalityContext}\n\n`;
        console.log(`DEBUG: Using personality only (no context) for user ${userId}`);
      }
      
      console.log(`DEBUG: Final personality context for user ${userId}:`, personalityContext.substring(0, 100) + '...');
      
      // Check if this is a direct question about what just happened or what BanterBox said
      const isDirectQuestionResult = originalMessage ? isDirectQuestion(originalMessage) : false;
      
      if (isDirectQuestionResult) {
        console.log(`DEBUG: Detected direct question: "${originalMessage}" - will provide factual answer`);
        // For direct questions, prioritize factual answers over personality
        const factualPrompt = buildFactualResponsePrompt(originalMessage || '', contextString, eventType, eventData);
        
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant that provides factual answers about recent events and conversations. When asked about what just happened or what was said, provide accurate information based on the context provided. Be direct and honest - if you don't have enough information, say so. Keep responses under 50 words and be conversational but factual."
            },
            {
              role: "user",
              content: factualPrompt
            }
          ],
          max_tokens: 150,
          temperature: 0.3, // Lower temperature for more factual responses
        });
        
        const factualResponse = response.choices[0].message.content || "I don't have enough context to answer that question.";
        
        // Record the factual response for future context
        if (contextId) {
          try {
            await ContextService.updateContextResponse(contextId, factualResponse);
          } catch (contextError) {
            console.error('Error updating context response:', contextError);
          }
        }
        
        return factualResponse;
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

      // Add pronunciation hints for common words that might be mispronounced
      let enhancedPrompt = prompt;
      if (originalMessage) {
        const lowerMessage = originalMessage.toLowerCase();
        if (lowerMessage.includes('altima')) {
          enhancedPrompt += "\n\nPronunciation note: 'Altima' is pronounced 'all-TEE-mah' (like 'all' + 'team' + 'ah').";
        }
        if (lowerMessage.includes('camry')) {
          enhancedPrompt += "\n\nPronunciation note: 'Camry' is pronounced 'CAM-ree' (like 'camera' without the 'a').";
        }
        if (lowerMessage.includes('civic')) {
          enhancedPrompt += "\n\nPronunciation note: 'Civic' is pronounced 'SIV-ik' (like 'civil' + 'ick').";
        }
        if (lowerMessage.includes('accord')) {
          enhancedPrompt += "\n\nPronunciation note: 'Accord' is pronounced 'ah-CORD' (like 'a' + 'cord').";
        }
        if (lowerMessage.includes('corolla')) {
          enhancedPrompt += "\n\nPronunciation note: 'Corolla' is pronounced 'kuh-ROLL-ah' (like 'coral' + 'ah').";
        }
        if (lowerMessage.includes('sentra')) {
          enhancedPrompt += "\n\nPronunciation note: 'Sentra' is pronounced 'SEN-trah' (like 'center' + 'ah').";
        }
        if (lowerMessage.includes('maxima')) {
          enhancedPrompt += "\n\nPronunciation note: 'Maxima' is pronounced 'MAX-ih-mah' (like 'maximum' + 'ah').";
        }
      }

      console.log(`DEBUG: Sending prompt to OpenAI for user ${userId}:`, enhancedPrompt.substring(0, 200) + '...');
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "Generate entertaining responses for live streamers. Keep responses engaging, fun, and under 25 words. Match the personality and energy requested. Use plain text only - no markdown formatting, asterisks, or special characters. Write naturally as if speaking. Be creative and varied - avoid repeating the same phrases or responses. Each response should feel fresh and unique. IMPORTANT: If context is provided, use it to remember what was discussed and refer back to it naturally. If someone mentioned something specific (like a car model, hobby, etc.), reference it in your response."
          },
          {
            role: "user",
            content: enhancedPrompt
          }
        ],
        max_tokens: 120,
        temperature: 1.1, // Increased temperature for more variety
        presence_penalty: 0.3, // Penalize repetition
        frequency_penalty: 0.5, // Penalize frequent words
      });

      console.log(`DEBUG: OpenAI response for user ${userId}:`, {
        hasResponse: !!response.choices[0],
        responseContent: response.choices[0]?.message?.content?.substring(0, 100) + '...',
        responseLength: response.choices[0]?.message?.content?.length || 0
      });

      const banterResponse = response.choices[0]?.message?.content || "Thanks for the interaction!";
      
      // Record the AI's response for future context
      if (contextId) {
        try {
          await ContextService.updateContextResponse(contextId, banterResponse);
        } catch (contextError) {
          console.error('Error updating context response:', contextError);
          // Don't fail banter generation if context update fails
        }
      }
      
      // Record successful banter for future context learning
      if (contextualUserId) {
        try {
          await ContextService.recordBanterSuccess(contextualUserId, eventType, eventData, banterResponse, guildId);
        } catch (contextError) {
          console.error('Error recording banter success:', contextError);
          // Don't fail banter generation if context recording fails
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

      // Check response frequency setting
      const userSettings = await storage.getUserSettings(userId);
      const responseFrequency = userSettings?.responseFrequency || 50; // Default to 50%
      
      // Apply response frequency filtering for Twitch events
      const shouldRespond = applyResponseFrequencyFilter(responseFrequency, 'twitch_event', originalMessage);
      if (!shouldRespond) {
        console.log(`Skipping Twitch response due to frequency setting (${responseFrequency}%)`);
        return;
      }
      
      // Generate the banter text
      const banterText = await generateBanter(eventType, eventData, originalMessage);
      
      // Get voice preferences from user settings
      const voiceProvider = userSettings?.voiceProvider || 'openai';
      const voiceId = userSettings?.voiceId;
      
      let audioUrl: string | null = null;
      
      // Generate audio using web dashboard voice settings
      try {
        if (voiceProvider === 'elevenlabs') {
          // Use ElevenLabs if configured
          const user = await storage.getUser(userId);
          const subscriptionTier = user?.subscriptionTier || 'free';
          const isPro = subscriptionTier === 'pro' || subscriptionTier === 'byok' || subscriptionTier === 'enterprise';
          
          if (isPro && voiceId) {
            const audioBuffer = await elevenLabsService.generateSpeech(banterText, voiceId);
            if (audioBuffer) {
              // Try Firebase first, fallback to object storage
              audioUrl = await firebaseStorage.saveAudioFile(audioBuffer) || await objectStorage.saveAudioFile(audioBuffer);
            }
          }
        } else if (voiceProvider === 'favorite') {
          // Use downloaded favorite voice
          const favoriteVoices = Array.isArray(userSettings?.favoriteVoices) ? userSettings.favoriteVoices as any[] : [];
          const selectedVoiceId = userSettings?.voiceId;
          
          console.log('Favorite voice generation debug:', {
            voiceProvider,
            selectedVoiceId,
            favoriteVoices: favoriteVoices.map((v: any) => ({ id: v.id, name: v.name, baseVoiceId: v.baseVoiceId, voiceId: v.voiceId })),
            settings: userSettings
          });
          
          if (selectedVoiceId && favoriteVoices.length > 0) {
            // Find the selected voice in favorites
            const selectedVoice = favoriteVoices.find((voice: any) => 
              voice.baseVoiceId === selectedVoiceId || voice.voiceId === selectedVoiceId
            );
            
            console.log('Selected voice found:', selectedVoice);
            
            if (selectedVoice) {
              const voiceId = selectedVoice.baseVoiceId || selectedVoice.voiceId;
              console.log('Using voice ID for generation:', voiceId);
              const audioBuffer = await elevenLabsService.generateSpeech(banterText, voiceId);
              if (audioBuffer) {
                // Try Firebase first, fallback to object storage
                audioUrl = await firebaseStorage.saveAudioFile(audioBuffer) || await objectStorage.saveAudioFile(audioBuffer);
              }
            }
          }
          
          // Fallback to default voice if no favorite voice found
          if (!audioUrl) {
            console.log('No favorite voice found, using default voice');
            const audioBuffer = await elevenLabsService.generateSpeech(banterText, elevenLabsService.getDefaultVoice());
            if (audioBuffer) {
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
        console.error("Error generating audio:", audioError as Error);
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
      
      console.log(`DEBUG: Created banter item for Twitch:`, {
        id: banterItem.id,
        userId,
        eventType,
        banterText: banterText.substring(0, 50) + '...',
        hasAudio: !!audioUrl
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
  async function generateTTS(text: string, userId: string, originalMessage?: string): Promise<Buffer | null> {
    try {
      // Get user settings to determine voice provider
      const settings = await storage.getUserSettings(userId);
      const voiceProvider = settings?.voiceProvider || 'openai';
      
      // Apply pronunciation hints to the text if original message is provided
      let enhancedText = text;
      if (originalMessage) {
        const lowerMessage = originalMessage.toLowerCase();
        if (lowerMessage.includes('altima')) {
          enhancedText = text.replace(/altima/gi, 'all-TEE-mah');
        }
        if (lowerMessage.includes('camry')) {
          enhancedText = text.replace(/camry/gi, 'CAM-ree');
        }
        if (lowerMessage.includes('civic')) {
          enhancedText = text.replace(/civic/gi, 'SIV-ik');
        }
        if (lowerMessage.includes('accord')) {
          enhancedText = text.replace(/accord/gi, 'ah-CORD');
        }
        if (lowerMessage.includes('corolla')) {
          enhancedText = text.replace(/corolla/gi, 'kuh-ROLL-ah');
        }
        if (lowerMessage.includes('sentra')) {
          enhancedText = text.replace(/sentra/gi, 'SEN-trah');
        }
        if (lowerMessage.includes('maxima')) {
          enhancedText = text.replace(/maxima/gi, 'MAX-ih-mah');
        }
      }
      
      if (voiceProvider === 'elevenlabs') {
        // Use ElevenLabs for Pro users
        const voiceId = settings?.voiceId || elevenLabsService.getDefaultVoice();
        return await elevenLabsService.generateSpeech(enhancedText, voiceId);
      } else if (voiceProvider === 'favorite') {
        // Use downloaded favorite voice
        const favoriteVoices = settings?.favoriteVoices || [];
        const selectedVoiceId = settings?.voiceId;
        
        console.log('Favorite voice generation debug:', {
          voiceProvider,
          selectedVoiceId,
          favoriteVoices: Array.isArray(favoriteVoices) ? favoriteVoices.map((v: any) => ({ id: v.id, name: v.name, baseVoiceId: v.baseVoiceId, voiceId: v.voiceId })) : [],
          settings: settings
        });
        
        if (selectedVoiceId && Array.isArray(favoriteVoices) && favoriteVoices.length > 0) {
          // Find the selected voice in favorites
          const selectedVoice = favoriteVoices.find((voice: any) => 
            voice.baseVoiceId === selectedVoiceId || voice.voiceId === selectedVoiceId
          );
          
          console.log('Selected voice found:', selectedVoice);
          
          if (selectedVoice) {
            const voiceId = selectedVoice.baseVoiceId || selectedVoice.voiceId;
            console.log('Using voice ID for generation:', voiceId);
            return await elevenLabsService.generateSpeech(enhancedText, voiceId);
          }
        }
        
        // Fallback to default voice if no favorite voice found
        console.log('No favorite voice found, using default voice');
        return await elevenLabsService.generateSpeech(enhancedText, elevenLabsService.getDefaultVoice());
      } else {
        // Use OpenAI TTS (default)
        const response = await openai.audio.speech.create({
          model: "tts-1",
          voice: "alloy",
          input: enhancedText,
        });
        return Buffer.from(await response.arrayBuffer());
      }
    } catch (error) {
      console.error('Error generating TTS:', error);
      return null;
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
      console.log(`DEBUG: Discord event - Guild: ${eventData.guildId}, Workspace User: ${workspaceUserId}`);
      
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

      // Check response frequency setting
      const userSettings = await storage.getUserSettings(workspaceUserId);
      const responseFrequency = userSettings?.responseFrequency || 50; // Default to 50%
      
      // Apply response frequency filtering
      const shouldRespond = applyResponseFrequencyFilter(responseFrequency, eventData.responseReason, originalMessage);
      if (!shouldRespond) {
        console.log(`Skipping response due to frequency setting (${responseFrequency}%) for reason: ${eventData.responseReason}`);
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
        } else if (voiceProvider === 'favorite') {
          // Use downloaded favorite voice
          const favoriteVoices = Array.isArray(userSettings?.favoriteVoices) ? userSettings.favoriteVoices as any[] : [];
          const selectedVoiceId = userSettings?.voiceId;
          
          console.log('Favorite voice generation debug:', {
            voiceProvider,
            selectedVoiceId,
            favoriteVoices: favoriteVoices.map((v: any) => ({ id: v.id, name: v.name, baseVoiceId: v.baseVoiceId, voiceId: v.voiceId })),
            settings: userSettings
          });
          
          if (selectedVoiceId && favoriteVoices.length > 0) {
            // Find the selected voice in favorites
            const selectedVoice = favoriteVoices.find((voice: any) => 
              voice.baseVoiceId === selectedVoiceId || voice.voiceId === selectedVoiceId
            );
            
            console.log('Selected voice found:', selectedVoice);
            
            if (selectedVoice) {
              const voiceId = selectedVoice.baseVoiceId || selectedVoice.voiceId;
              console.log('Using voice ID for generation:', voiceId);
              const audioBuffer = await elevenLabsService.generateSpeech(banterText, voiceId);
              if (audioBuffer) {
                // Try Firebase first, fallback to object storage
                audioUrl = await firebaseStorage.saveAudioFile(audioBuffer) || await objectStorage.saveAudioFile(audioBuffer);
              }
            }
          }
          
          // Fallback to default voice if no favorite voice found
          if (!audioUrl) {
            console.log('No favorite voice found, using default voice');
            const audioBuffer = await elevenLabsService.generateSpeech(banterText, elevenLabsService.getDefaultVoice());
            if (audioBuffer) {
              audioUrl = await firebaseStorage.saveAudioFile(audioBuffer) || await objectStorage.saveAudioFile(audioBuffer);
            }
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
          console.log(`RENDER_EXTERNAL_HOSTNAME env var: ${process.env.RENDER_EXTERNAL_HOSTNAME ? 'SET' : 'NOT_SET'}`);
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
            console.log(`Audio URL not accessible:`, error instanceof Error ? error.message : 'Unknown error');
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
        console.error("Error generating Discord audio:", audioError as Error);
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
      
      console.log(`DEBUG: Created banter item for Discord:`, {
        id: banterItem.id,
        userId: workspaceUserId,
        eventType: eventTypeForBanter,
        banterText: banterText.substring(0, 50) + '...',
        hasAudio: !!audioUrl
      });
      
      // Broadcast to overlay via WebSocket
      broadcast({
        type: 'new_banter',
        banter: banterItem
      });
      
      console.log(`Successfully generated and broadcast banter for Discord ${eventType} event`);
          } catch (error) {
        console.error("Error generating banter from Discord event:", error as Error);
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
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
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
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
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
      const authenticatedUserId = (req.user as any)?.id;
      if (!authenticatedUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
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
          banterPersonality: 'context',
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
      const authenticatedUserId = (req.user as any)?.id;
      if (!authenticatedUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
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
                      banterPersonality: updates.banterPersonality || 'context',
          customPersonalityPrompt: updates.customPersonalityPrompt || null,
        });
        updated = newSettings;
      }
      
      // Broadcast settings update to connected clients
      broadcast({
        type: 'settings_updated',
        userId,
        settings: updated
      });
      
      console.log(`DEBUG: Settings updated for user ${userId}:`, {
        banterPersonality: updated?.banterPersonality,
        customPersonalityPrompt: updated?.customPersonalityPrompt ? 'Has custom prompt' : 'No custom prompt',
        voiceProvider: updated?.voiceProvider,
        voiceId: updated?.voiceId
      });
      
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
        const audioBuffer = await generateTTS(banterText, userId, originalMessage);
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
  app.post("/api/discord/link-code", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
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
  app.get("/api/discord/status/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const authenticatedUserId = req.user?.id;
      
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
          guildName: 'Unknown',
          linkedByUserId: link.linkedByUserId,
          createdAt: link.createdAt,
          verified: false
        }));
      }
      
      res.json({
        success: true,
        guilds: verifiedGuilds,
        totalGuilds: verifiedGuilds.length,
        staleConnections,
        botConnected: !!globalDiscordService,
        botHealthy: globalDiscordService?.isHealthy() || false
      });
    } catch (error) {
      console.error('Error getting Discord status:', error);
      res.status(500).json({ message: "Failed to get Discord status" });
    }
  });

  // Get detailed multi-server connectivity statistics
  app.get("/api/discord/connectivity-stats", isAuthenticated, async (req, res) => {
    try {
      if (!globalDiscordService) {
        return res.json({
          success: false,
          message: "Discord bot not connected",
          stats: null
        });
      }

      const connectionStats = globalDiscordService.getConnectionStats();
      const currentGuilds = globalDiscordService.getCurrentGuilds();
      
      // Get all active guild links from database
      const allGuildLinks = await db.select().from(guildLinks).where(eq(guildLinks.active, true));
      
      // Calculate connectivity metrics
      const totalLinkedGuilds = allGuildLinks.length;
      const actuallyConnectedGuilds = currentGuilds.length;
      const connectedButNotLinked = currentGuilds.filter(guild => 
        !allGuildLinks.some(link => link.guildId === guild.id)
      ).length;
      const linkedButNotConnected = allGuildLinks.filter(link => 
        !currentGuilds.some(guild => guild.id === link.guildId)
      ).length;

      res.json({
        success: true,
        stats: {
          ...connectionStats,
          currentGuilds: currentGuilds,
          totalLinkedGuilds,
          actuallyConnectedGuilds,
          connectedButNotLinked,
          linkedButNotConnected,
          connectivityHealth: {
            percentage: totalLinkedGuilds > 0 ? (actuallyConnectedGuilds / totalLinkedGuilds) * 100 : 0,
            status: linkedButNotConnected > 0 ? 'warning' : 'healthy'
          }
        }
      });
    } catch (error) {
      console.error('Error getting connectivity stats:', error);
      res.status(500).json({ message: "Failed to get connectivity stats" });
    }
  });

  // Clean up stale Discord connections
  app.post("/api/discord/cleanup-stale", isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.body;
      const authenticatedUserId = (req.user as any)?.id;
      if (!authenticatedUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
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
      const authenticatedUserId = (req.user as any)?.id;
      if (!authenticatedUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
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
      res.status(500).json({ message: "Failed to restart Discord bot", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Manage favorite personalities
  app.post("/api/favorites/personalities", isAuthenticated, async (req, res) => {
    try {
      const { name, prompt, description } = req.body;
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Input validation
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ message: "Name is required and must be a non-empty string" });
      }
      
      if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
        return res.status(400).json({ message: "Prompt is required and must be a non-empty string" });
      }
      
      if (name.length > 100) {
        return res.status(400).json({ message: "Name must be 100 characters or less" });
      }
      
      if (prompt.length > 2000) {
        return res.status(400).json({ message: "Prompt must be 2000 characters or less" });
      }
      
      if (description && (typeof description !== 'string' || description.length > 500)) {
        return res.status(400).json({ message: "Description must be a string and 500 characters or less" });
      }
      
      const settings = await storage.getUserSettings(userId);
      const currentFavorites = Array.isArray(settings?.favoritePersonalities) ? settings.favoritePersonalities as any[] : [];
      
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
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const settings = await storage.getUserSettings(userId);
      const favorites = Array.isArray(settings?.favoritePersonalities) ? settings.favoritePersonalities as any[] : [];
      
      res.json({ personalities: favorites });
    } catch (error) {
      console.error('Error getting favorite personalities:', error);
      res.status(500).json({ message: "Failed to get personalities" });
    }
  });

  app.delete("/api/favorites/personalities/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const settings = await storage.getUserSettings(userId);
      const currentFavorites = Array.isArray(settings?.favoritePersonalities) ? settings.favoritePersonalities as any[] : [];
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
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      if (!name || !voiceId || !provider) {
        return res.status(400).json({ message: "Name, voiceId, and provider are required" });
      }
      
      const settings = await storage.getUserSettings(userId);
      const currentFavorites = Array.isArray(settings?.favoriteVoices) ? settings.favoriteVoices as any[] : [];
      
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
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
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
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const settings = await storage.getUserSettings(userId);
      const currentFavorites = Array.isArray(settings?.favoriteVoices) ? settings.favoriteVoices as any[] : [];
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
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  });

  // Test Discord database operations
  app.post("/api/discord/test-db", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      console.log(`🧪 Testing Discord DB operations for user: ${userId}`);
      
      const results: {
        tests: Array<{ name: string; status: string; data: any }>;
        success: boolean;
        errors: Array<{ test: string; error: string; stack?: string }>;
      } = {
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
                  error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
        });
        console.error('Database test error:', error);
      }
      
      res.json(results);
    } catch (error) {
      console.error('Test endpoint error:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined 
      });
    }
  });

  // Clear ALL Discord cache/connections for fresh start
  app.post("/api/discord/clear-cache", isAuthenticated, async (req, res) => {
    try {
      const authenticatedUserId = (req.user as any)?.id;
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
        const audioBuffer = await generateTTS(banterText, userId, testMessage);
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
      const subscriptionTier = user?.subscriptionTier || 'free';
      const isPro = subscriptionTier === 'pro' || subscriptionTier === 'byok' || subscriptionTier === 'enterprise';
      
      if (!isPro) {
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
      const { voiceId, text } = req.body;
      const userId = req.user.id;
      
      const user = await storage.getUser(userId);
      const subscriptionTier = user?.subscriptionTier || 'free';
      const isPro = subscriptionTier === 'pro' || subscriptionTier === 'byok' || subscriptionTier === 'enterprise';
      
      if (!isPro) {
        return res.status(403).json({ 
          message: "ElevenLabs voices require Pro subscription",
          upgrade: "Upgrade to Pro to access premium voices"
        });
      }

      if (!voiceId) {
        return res.status(400).json({ message: "VoiceId is required" });
      }

      const testText = text || "Hello! This is a test of your selected voice.";
      
      // Generate audio using ElevenLabs
      const audioBuffer = await elevenLabsService.generateSpeech(testText, voiceId);
      
      // Set appropriate headers for audio
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length,
      });
      
      res.send(audioBuffer);
    } catch (error) {
      console.error('Error testing ElevenLabs voice:', error);
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

  // Marketplace API routes
  app.get("/api/marketplace/personalities", async (req, res) => {
    try {
      const { category, sortBy, search, limit } = req.query;
      const { firebaseMarketplaceService } = await import('./firebaseMarketplace');
      
      const personalities = await firebaseMarketplaceService.getPersonalities({
        category: category as string,
        sortBy: sortBy as string,
        search: search as string,
        limit: limit ? parseInt(limit as string) : 50,
        onlyApproved: true // Only show approved items
      });
      
      console.log('Marketplace personalities query result:', {
        count: personalities?.length || 0,
        personalities: personalities?.map(p => ({ id: p.id, name: p.name, isActive: p.isActive, moderationStatus: p.moderationStatus }))
      });
      
      // Fallback to sample data if database is empty
      if (!personalities || personalities.length === 0) {
        const samplePersonalities = [
          {
            id: "1",
            name: "Gaming Guru",
            description: "Perfect for gaming streams with witty commentary",
            prompt: "You are a gaming expert with deep knowledge of games. Provide insightful commentary, tips, and reactions to gaming moments. Keep responses engaging and informative.",
            category: "Gaming",
            tags: ["gaming", "expert", "commentary"],
            authorName: "BanterBox Team",
            isVerified: true,
            downloads: 1250,
            upvotes: 89,
            downvotes: 3,
            isActive: true,
            createdAt: "2024-01-15T10:00:00Z",
            updatedAt: "2024-01-15T10:00:00Z"
          },
          {
            id: "2",
            name: "Comedy Master",
            description: "Hilarious responses that keep everyone laughing",
            prompt: "You are a comedy master who creates hilarious responses. Use clever jokes, puns, and witty observations. Keep the humor clean and entertaining for all ages.",
            category: "Comedy",
            tags: ["comedy", "humor", "entertainment"],
            authorName: "BanterBox Team",
            isVerified: true,
            downloads: 2100,
            upvotes: 156,
            downvotes: 7,
            isActive: true,
            createdAt: "2024-01-10T14:30:00Z",
            updatedAt: "2024-01-10T14:30:00Z"
          },
          {
            id: "3",
            name: "Educational Expert",
            description: "Great for educational content and learning streams",
            prompt: "You are an educational expert who explains concepts clearly and engagingly. Provide helpful insights, answer questions, and make learning fun and accessible.",
            category: "Education",
            tags: ["education", "learning", "helpful"],
            authorName: "BanterBox Team",
            isVerified: true,
            downloads: 890,
            upvotes: 67,
            downvotes: 2,
            isActive: true,
            createdAt: "2024-01-20T09:15:00Z",
            updatedAt: "2024-01-20T09:15:00Z"
          }
        ];
        return res.json(samplePersonalities);
      }

      res.json(personalities);
    } catch (error) {
      console.error('Error getting marketplace personalities:', error);
      res.status(500).json({ message: "Failed to get marketplace personalities" });
    }
  });

  // Save personality (private or to marketplace)
  app.post("/api/personality-builder/save", isAuthenticated, async (req, res) => {
    try {
      const { name, description, prompt, category, tags, addToMarketplace } = req.body;
      const userId = req.user.id;
      
      console.log('Personality save request:', { userId, name, addToMarketplace }); // Debug log
      
      if (!name || !prompt) {
        return res.status(400).json({ message: "Name and prompt are required" });
      }
      
      // Check subscription tier - personality builder requires Pro or higher
      const user = await storage.getUser(userId);
      const subscriptionTier = user?.subscriptionTier || 'free';
      const isPro = subscriptionTier === 'pro' || subscriptionTier === 'byok' || subscriptionTier === 'enterprise';
      
      if (!isPro) {
        return res.status(403).json({ 
          message: "Personality Builder requires Pro subscription",
          upgrade: "Upgrade to Pro to access custom personality creation"
        });
      }
      
      // Create the personality object
      const newPersonality = {
        id: randomUUID(),
        name: name.trim(),
        prompt: prompt.trim(),
        description: description ? description.trim() : "",
        category: category || "Custom",
        tags: tags && tags.length > 0 ? tags : ["custom"],
        authorName: "You",
        isVerified: false,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      console.log('Created personality object:', newPersonality); // Debug log
      
      // Always save to user's favorite personalities (private library)
      const settings = await storage.getUserSettings(userId);
      const currentFavorites = Array.isArray(settings?.favoritePersonalities) ? settings.favoritePersonalities : [];
      const updatedFavorites = [...currentFavorites, newPersonality];
      
      console.log('Updating user settings with personality:', { 
        userId, 
        currentFavoritesCount: currentFavorites.length,
        updatedFavoritesCount: updatedFavorites.length 
      }); // Debug log
      
      await storage.updateUserSettings(userId, {
        favoritePersonalities: updatedFavorites
      });
      
      // If addToMarketplace is true, also save to marketplace
      if (addToMarketplace) {
        try {
                  const { firebaseMarketplaceService } = await import('./firebaseMarketplace');
        const marketplacePersonality = await firebaseMarketplaceService.createPersonality({
            name: name.trim(),
            description: description ? description.trim() : "",
            prompt: prompt.trim(),
            category: category || "Custom",
            tags: tags && tags.length > 0 ? tags : ["custom"],
            authorId: userId,
            authorName: user?.firstName || user?.email || "Anonymous",
            isActive: true,
            isVerified: false,
            downloads: 0,
            upvotes: 0,
            downvotes: 0,
            moderationStatus: 'approved' // Auto-approve all marketplace uploads
          });
          console.log('Personality submitted to marketplace:', marketplacePersonality.id);
        } catch (error) {
          console.error('Failed to submit personality to marketplace:', error);
          // Don't fail the whole operation if marketplace submission fails
        }
      }
      
      res.json({ 
        success: true, 
        personality: newPersonality,
        message: addToMarketplace 
          ? "Personality saved to your library and added to marketplace!" 
          : "Personality saved to your library!"
      });
    } catch (error) {
      console.error('Error saving personality:', error);
      res.status(500).json({ message: "Failed to save personality" });
    }
  });

  // Legacy endpoint - redirect to new one
  app.post("/api/marketplace/personalities", isAuthenticated, async (req, res) => {
    // This endpoint is kept for backward compatibility
    // It now just calls the new endpoint with addToMarketplace = true
    req.body.addToMarketplace = true;
    return app._router.handle(
      Object.assign(req, { url: '/api/personality-builder/save', path: '/api/personality-builder/save' }), 
      res
    );
  });

  app.post("/api/marketplace/personalities/:personalityId/download", isAuthenticated, async (req, res) => {
    try {
      const { personalityId } = req.params;
      const userId = req.user.id;
      const { firebaseMarketplaceService } = await import('./firebaseMarketplace');
      
      // Get the personality from marketplace
      const personalityToDownload = await firebaseMarketplaceService.getPersonality(personalityId);
      if (!personalityToDownload) {
        return res.status(404).json({ message: "Personality not found" });
      }
      
      // Check if user already downloaded
      const alreadyDownloaded = await firebaseMarketplaceService.hasUserDownloaded(userId, 'personality', personalityId);
      if (alreadyDownloaded) {
        return res.status(400).json({ 
          success: false,
          message: "Personality already downloaded",
          personalityId 
        });
      }
      
      // Add to user's favorites
      const userSettings = await storage.getUserSettings(userId);
      const currentFavorites = Array.isArray(userSettings?.favoritePersonalities) ? userSettings.favoritePersonalities : [];
      
      const downloadedPersonality = {
        id: randomUUID(),
        name: personalityToDownload.name,
        description: personalityToDownload.description,
        prompt: personalityToDownload.prompt,
        category: personalityToDownload.category,
        tags: personalityToDownload.tags,
        authorName: personalityToDownload.authorName,
        isVerified: personalityToDownload.isVerified,
        downloadedAt: new Date().toISOString(),
        originalPersonalityId: personalityId
      };
      
      const updatedFavorites = [...currentFavorites, downloadedPersonality];
      
      await storage.updateUserSettings(userId, {
        favoritePersonalities: updatedFavorites
      });
      
      // Track download
      await firebaseMarketplaceService.downloadItem(userId, 'personality', personalityId);
      
      console.log(`Personality "${personalityToDownload.name}" downloaded by user ${userId}`);
      
      res.json({ 
        success: true, 
        message: "Personality downloaded successfully and added to your library",
        personalityId,
        personalityName: personalityToDownload.name
      });
    } catch (error) {
      console.error('Error downloading personality:', error);
      res.status(500).json({ message: "Failed to download personality" });
    }
  });
  
  // Legacy download endpoint using sample data (remove after migration)
  app.post("/api/marketplace/personalities/:personalityId/download-sample", isAuthenticated, async (req, res) => {
    try {
      const { personalityId } = req.params;
      const userId = req.user.id;
      
      const samplePersonalities = [
        {
          id: "1",
          name: "Gaming Guru",
          description: "Perfect for gaming streams with witty commentary",
          prompt: "You are a gaming expert with deep knowledge of games. Provide insightful commentary, tips, and reactions to gaming moments. Keep responses engaging and informative.",
          category: "Gaming",
          tags: ["gaming", "expert", "commentary"],
          authorName: "BanterBox Team",
          isVerified: true,
          downloads: 1250,
          upvotes: 89,
          downvotes: 3,
          isActive: true,
          createdAt: "2024-01-15T10:00:00Z",
          updatedAt: "2024-01-15T10:00:00Z"
        },
        {
          id: "2",
          name: "Comedy Master",
          description: "Hilarious responses that keep everyone laughing",
          prompt: "You are a comedy master who creates hilarious responses. Use clever jokes, puns, and witty observations. Keep the humor clean and entertaining for all ages.",
          category: "Comedy",
          tags: ["comedy", "humor", "entertainment"],
          authorName: "BanterBox Team",
          isVerified: true,
          downloads: 2100,
          upvotes: 156,
          downvotes: 7,
          isActive: true,
          createdAt: "2024-01-10T14:30:00Z",
          updatedAt: "2024-01-10T14:30:00Z"
        },
        {
          id: "3",
          name: "Educational Expert",
          description: "Great for educational content and learning streams",
          prompt: "You are an educational expert who explains concepts clearly and engagingly. Provide helpful insights, answer questions, and make learning fun and accessible.",
          category: "Education",
          tags: ["education", "learning", "helpful"],
          authorName: "BanterBox Team",
          isVerified: true,
          downloads: 890,
          upvotes: 67,
          downvotes: 2,
          isActive: true,
          createdAt: "2024-01-20T09:15:00Z",
          updatedAt: "2024-01-20T09:15:00Z"
        }
      ];
      
      const personalityToDownload = samplePersonalities.find(personality => personality.id === personalityId);
      if (!personalityToDownload) {
        return res.status(404).json({ message: "Personality not found" });
      }
      
      // Check if user already has this personality
      const userSettings = await storage.getUserSettings(userId);
      const currentFavorites = Array.isArray(userSettings?.favoritePersonalities) ? userSettings.favoritePersonalities : [];
      const alreadyDownloaded = currentFavorites.some((personality: any) => 
        personality.name === personalityToDownload.name && 
        personality.prompt === personalityToDownload.prompt
      );
      
      if (alreadyDownloaded) {
        return res.status(400).json({ 
          success: false,
          message: "Personality already downloaded",
          personalityId 
        });
      }
      
      // Add personality to user's favorite personalities
      const downloadedPersonality = {
        id: randomUUID(),
        name: personalityToDownload.name,
        description: personalityToDownload.description,
        prompt: personalityToDownload.prompt,
        category: personalityToDownload.category,
        tags: personalityToDownload.tags,
        authorName: personalityToDownload.authorName,
        isVerified: personalityToDownload.isVerified,
        downloadedAt: new Date().toISOString(),
        originalPersonalityId: personalityId
      };
      
      const updatedFavorites = [...currentFavorites, downloadedPersonality];
      
      await storage.updateUserSettings(userId, {
        favoritePersonalities: updatedFavorites
      });
      
      console.log(`Personality "${personalityToDownload.name}" downloaded by user ${userId}`);
      
      res.json({ 
        success: true, 
        message: "Personality downloaded successfully and added to your library",
        personalityId,
        personalityName: personalityToDownload.name
      });
    } catch (error) {
      console.error('Error downloading personality:', error);
      res.status(500).json({ message: "Failed to download personality" });
    }
  });

  app.post("/api/personality/test", isAuthenticated, async (req, res) => {
    try {
      const { personality, prompt, message } = req.body;
      const userId = req.user.id;
      
      // Check subscription tier - personality builder requires Pro or higher
      const user = await storage.getUser(userId);
      const subscriptionTier = user?.subscriptionTier || 'free';
      const isPro = subscriptionTier === 'pro' || subscriptionTier === 'byok' || subscriptionTier === 'enterprise';
      
      if (!isPro) {
        return res.status(403).json({ 
          message: "Personality Builder requires Pro subscription",
          upgrade: "Upgrade to Pro to access custom personality creation"
        });
      }
      
      // Use the provided prompt or get from personality preset
      let personalityPrompt = prompt;
      if (!personalityPrompt && personality && personality !== 'custom') {
        const personalityPrompts = {
          witty: "Be witty and clever with natural wordplay and humor. Keep responses under 25 words. Be creative and avoid repetition.",
          friendly: "Be warm and encouraging with positive energy. Respond naturally and supportively. Show genuine interest and vary your responses.",
          sarcastic: "Be playfully sarcastic but fun, not mean. Use clever sarcasm and natural comebacks. Mix up your sarcastic style.",
          hype: "BE HIGH-ENERGY! Use caps and exclamation points! GET EVERYONE PUMPED UP! Vary your hype energy levels.",
          chill: "Stay relaxed and laid-back. Keep responses natural, zen, and easygoing. Mix up your chill vibes.",
          context: "Be context-aware and reference conversation history naturally. Use previous interactions and ongoing topics to create more relevant responses. Keep responses under 25 words. Make connections to past events when appropriate.",
          roast: "Be playfully roasting and teasing. Use clever burns that are funny, not hurtful. Vary your roasting style."
        };
        personalityPrompt = personalityPrompts[personality as keyof typeof personalityPrompts] || personalityPrompts.witty;
      }
      
      if (!personalityPrompt) {
        return res.status(400).json({ message: "Personality prompt is required" });
      }
      
      const testMessage = message || "Hey banterbox, test the personality!";
      
      // Generate test response using OpenAI
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: personalityPrompt
          },
          {
            role: "user",
            content: `Respond to this message: "${testMessage}"`
          }
        ],
        max_tokens: 50,
        temperature: 0.8
      });
      
      const banterText = completion.choices[0]?.message?.content?.trim() || "Test response generated!";
      
      res.json({
        success: true,
        banterText,
        testMessage,
        personality: personality || 'custom'
      });
    } catch (error) {
      console.error('Error testing personality:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Voice Marketplace API routes
  app.get("/api/marketplace/voices", async (req, res) => {
    try {
      const { category, sortBy, search, limit } = req.query;
      const { firebaseMarketplaceService } = await import('./firebaseMarketplace');
      
      const voices = await firebaseMarketplaceService.getVoices({
        category: category as string,
        sortBy: sortBy as string,
        search: search as string,
        limit: limit ? parseInt(limit as string) : 50,
        onlyApproved: true // Only show approved items
      });
      
      console.log('Marketplace voices query result:', {
        count: voices?.length || 0,
        voices: voices?.map(v => ({ id: v.id, name: v.name, isActive: v.isActive, moderationStatus: v.moderationStatus }))
      });
      
      // Fallback to sample data if database is empty
      if (!voices || voices.length === 0) {
        const sampleVoices = [
          {
            id: "1",
            name: "Gaming Warrior",
            description: "Perfect for gaming streams with energetic commentary",
            category: "Gaming",
            tags: ["gaming", "energetic", "warrior"],
            voiceId: "21m00Tcm4TlvDq8ikWAM",
            baseVoiceId: "21m00Tcm4TlvDq8ikWAM",
            settings: {
              stability: 60,
              similarityBoost: 80,
              style: 20,
              useSpeakerBoost: true
            },
            sampleText: "Welcome to the stream! Let's dominate this game!",
            downloads: 850,
            upvotes: 67,
            downvotes: 2,
            createdAt: "2024-01-15T10:00:00Z",
            authorId: "user1"
          },
          {
            id: "2",
            name: "Chill Vibes",
            description: "Relaxed and laid-back voice for casual streams",
            category: "Entertainment",
            tags: ["chill", "relaxed", "casual"],
            voiceId: "ErXwobaYiN019PkySvjV",
            baseVoiceId: "ErXwobaYiN019PkySvjV",
            settings: {
              stability: 75,
              similarityBoost: 70,
              style: 10,
              useSpeakerBoost: false
            },
            sampleText: "Hey everyone, thanks for hanging out with us today.",
            downloads: 1200,
            upvotes: 89,
            downvotes: 5,
            createdAt: "2024-01-10T14:30:00Z",
            authorId: "user2"
          },
          {
            id: "3",
            name: "Professional Narrator",
            description: "Clear and professional voice for educational content",
            category: "Education",
            tags: ["professional", "clear", "educational"],
            voiceId: "JBFqnCBsd6RMkjVDRZzb",
            baseVoiceId: "JBFqnCBsd6RMkjVDRZzb",
            settings: {
              stability: 85,
              similarityBoost: 90,
              style: 5,
              useSpeakerBoost: true
            },
            sampleText: "Today we'll be exploring the fascinating world of science.",
            downloads: 650,
            upvotes: 45,
            downvotes: 1,
            createdAt: "2024-01-20T09:15:00Z",
            authorId: "user3"
          }
        ];
        return res.json(sampleVoices);
      }

      res.json(voices);
    } catch (error) {
      console.error('Error getting marketplace voices:', error);
      res.status(500).json({ message: "Failed to get marketplace voices" });
    }
  });
  
  // Legacy sample voices endpoint (for testing)
  app.get("/api/marketplace/voices/sample", async (req, res) => {
    try {
      const { category, sortBy, limit } = req.query;
      
      const sampleVoices = [
        {
          id: "1",
          name: "Gaming Warrior",
          description: "Perfect for gaming streams with energetic commentary",
          category: "Gaming",
          tags: ["gaming", "energetic", "warrior"],
          baseVoiceId: "21m00Tcm4TlvDq8ikWAM",
          settings: {
            stability: 60,
            similarityBoost: 80,
            style: 20,
            useSpeakerBoost: true
          },
          sampleText: "Welcome to the stream! Let's dominate this game!",
          downloads: 850,
          upvotes: 67,
          downvotes: 2,
          createdAt: "2024-01-15T10:00:00Z",
          authorId: "user1"
        },
        {
          id: "2",
          name: "Chill Vibes",
          description: "Relaxed and laid-back voice for casual streams",
          category: "Entertainment",
          tags: ["chill", "relaxed", "casual"],
          baseVoiceId: "ErXwobaYiN019PkySvjV",
          settings: {
            stability: 75,
            similarityBoost: 70,
            style: 10,
            useSpeakerBoost: false
          },
          sampleText: "Hey everyone, thanks for hanging out with us today.",
          downloads: 1200,
          upvotes: 89,
          downvotes: 5,
          createdAt: "2024-01-10T14:30:00Z",
          authorId: "user2"
        },
        {
          id: "3",
          name: "Professional Narrator",
          description: "Clear and professional voice for educational content",
          category: "Education",
          tags: ["professional", "clear", "educational"],
          baseVoiceId: "JBFqnCBsd6RMkjVDRZzb",
          settings: {
            stability: 85,
            similarityBoost: 90,
            style: 5,
            useSpeakerBoost: true
          },
          sampleText: "Today we'll be exploring the fascinating world of science.",
          downloads: 650,
          upvotes: 45,
          downvotes: 1,
          createdAt: "2024-01-20T09:15:00Z",
          authorId: "user3"
        }
      ];
      
      // Filter by category if specified
      let filteredVoices = sampleVoices;
      if (category && category !== 'all') {
        filteredVoices = sampleVoices.filter(voice => voice.category === category);
      }
      
      // Sort voices
      if (sortBy === 'popular') {
        filteredVoices.sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes));
      } else if (sortBy === 'downloads') {
        filteredVoices.sort((a, b) => b.downloads - a.downloads);
      } else {
        // Default: recent
        filteredVoices.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
      
      // Apply limit
      const limitNum = parseInt(limit as string) || 20;
      filteredVoices = filteredVoices.slice(0, limitNum);
      
      res.json(filteredVoices);
    } catch (error) {
      console.error('Error getting marketplace voices:', error);
      res.status(500).json({ message: "Failed to get marketplace voices" });
    }
  });

  app.post("/api/marketplace/voices/:voiceId/download", isAuthenticated, async (req, res) => {
    try {
      const { voiceId } = req.params;
      const userId = req.user.id;
      const { firebaseMarketplaceService } = await import('./firebaseMarketplace');
      
      // Get the voice from marketplace
      const voiceToDownload = await firebaseMarketplaceService.getVoice(voiceId);
      if (!voiceToDownload) {
        return res.status(404).json({ message: "Voice not found" });
      }
      
      // Check if user already downloaded
      const alreadyDownloaded = await firebaseMarketplaceService.hasUserDownloaded(userId, 'voice', voiceId);
      if (alreadyDownloaded) {
        return res.status(400).json({ 
          success: false,
          message: "Voice already downloaded",
          voiceId 
        });
      }
      
      // Add to user's favorites
      const userSettings = await storage.getUserSettings(userId);
      const currentFavorites = userSettings?.favoriteVoices || [];
      
      const downloadedVoice = {
        id: randomUUID(),
        name: voiceToDownload.name,
        description: voiceToDownload.description,
        category: voiceToDownload.category,
        tags: voiceToDownload.tags,
        voiceId: voiceToDownload.voiceId,
        baseVoiceId: voiceToDownload.baseVoiceId,
        settings: voiceToDownload.settings,
        sampleText: voiceToDownload.sampleText,
        provider: 'elevenlabs',
        downloadedAt: new Date().toISOString(),
        originalVoiceId: voiceId
      };
      
      const updatedFavorites = [...currentFavorites, downloadedVoice];
      
      await storage.updateUserSettings(userId, {
        favoriteVoices: updatedFavorites
      });
      
      // Track download
      await firebaseMarketplaceService.downloadItem(userId, 'voice', voiceId);
      
      console.log(`Voice "${voiceToDownload.name}" downloaded by user ${userId}`);
      
      res.json({ 
        success: true, 
        message: "Voice downloaded successfully and added to your library",
        voiceId,
        voiceName: voiceToDownload.name
      });
    } catch (error) {
      console.error('Error downloading voice:', error);
      res.status(500).json({ message: "Failed to download voice" });
    }
  });
  
  // Legacy download endpoint using sample data (remove after migration)
  app.post("/api/marketplace/voices/:voiceId/download-sample", isAuthenticated, async (req, res) => {
    try {
      const { voiceId } = req.params;
      const userId = req.user.id;
      
      const sampleVoices = [
        {
          id: "1",
          name: "Gaming Warrior",
          description: "Perfect for gaming streams with energetic commentary",
          category: "Gaming",
          tags: ["gaming", "energetic", "warrior"],
          baseVoiceId: "21m00Tcm4TlvDq8ikWAM",
          settings: {
            stability: 60,
            similarityBoost: 80,
            style: 20,
            useSpeakerBoost: true
          },
          sampleText: "Welcome to the stream! Let's dominate this game!",
          downloads: 850,
          upvotes: 67,
          downvotes: 2,
          createdAt: "2024-01-15T10:00:00Z",
          authorId: "user1"
        },
        {
          id: "2",
          name: "Chill Vibes",
          description: "Relaxed and laid-back voice for casual streams",
          category: "Entertainment",
          tags: ["chill", "relaxed", "casual"],
          baseVoiceId: "ErXwobaYiN019PkySvjV",
          settings: {
            stability: 75,
            similarityBoost: 70,
            style: 10,
            useSpeakerBoost: false
          },
          sampleText: "Hey everyone, thanks for hanging out with us today.",
          downloads: 1200,
          upvotes: 89,
          downvotes: 5,
          createdAt: "2024-01-10T14:30:00Z",
          authorId: "user2"
        },
        {
          id: "3",
          name: "Professional Narrator",
          description: "Clear and professional voice for educational content",
          category: "Education",
          tags: ["professional", "clear", "educational"],
          baseVoiceId: "JBFqnCBsd6RMkjVDRZzb",
          settings: {
            stability: 85,
            similarityBoost: 90,
            style: 5,
            useSpeakerBoost: true
          },
          sampleText: "Today we'll be exploring the fascinating world of science.",
          downloads: 650,
          upvotes: 45,
          downvotes: 1,
          createdAt: "2024-01-20T09:15:00Z",
          authorId: "user3"
        }
      ];
      
      const voiceToDownload = sampleVoices.find(voice => voice.id === voiceId);
      if (!voiceToDownload) {
        return res.status(404).json({ message: "Voice not found" });
      }
      
      // Check if user already has this voice
      const userSettings = await storage.getUserSettings(userId);
      const currentFavorites = userSettings?.favoriteVoices || [];
      const alreadyDownloaded = currentFavorites.some((voice: any) => 
        voice.baseVoiceId === voiceToDownload.baseVoiceId && 
        voice.name === voiceToDownload.name
      );
      
      if (alreadyDownloaded) {
        return res.status(400).json({ 
          success: false,
          message: "Voice already downloaded",
          voiceId 
        });
      }
      
      // Add voice to user's favorite voices
      const downloadedVoice = {
        id: randomUUID(),
        name: voiceToDownload.name,
        description: voiceToDownload.description,
        category: voiceToDownload.category,
        tags: voiceToDownload.tags,
        voiceId: voiceToDownload.baseVoiceId, // Changed to voiceId to match frontend expectations
        baseVoiceId: voiceToDownload.baseVoiceId, // Keep for backward compatibility
        settings: voiceToDownload.settings,
        sampleText: voiceToDownload.sampleText,
        provider: 'elevenlabs', // All marketplace voices are ElevenLabs
        downloadedAt: new Date().toISOString(),
        originalVoiceId: voiceId
      };
      
      const updatedFavorites = [...currentFavorites, downloadedVoice];
      
      await storage.updateUserSettings(userId, {
        favoriteVoices: updatedFavorites
      });
      
      console.log(`Voice "${voiceToDownload.name}" downloaded by user ${userId}`);
      
      res.json({ 
        success: true, 
        message: "Voice downloaded successfully and added to your library",
        voiceId,
        voiceName: voiceToDownload.name
      });
    } catch (error) {
      console.error('Error downloading voice:', error);
      res.status(500).json({ message: "Failed to download voice" });
    }
  });

  // Voice Builder API routes
  app.post("/api/voice-builder/preview", isAuthenticated, async (req, res) => {
    try {
      const { text, baseVoiceId, settings } = req.body;
      const userId = req.user.id;
      
      if (!text || !baseVoiceId) {
        return res.status(400).json({ message: "Text and baseVoiceId are required" });
      }
      
      // Check subscription tier - voice builder requires Pro or higher
      const user = await storage.getUser(userId);
      const subscriptionTier = user?.subscriptionTier || 'free';
      const isPro = subscriptionTier === 'pro' || subscriptionTier === 'byok' || subscriptionTier === 'enterprise';
      
      if (!isPro) {
        return res.status(403).json({ 
          message: "Voice Builder requires Pro subscription",
          upgrade: "Upgrade to Pro to access custom voice creation"
        });
      }
      
      // Generate audio using ElevenLabs with the provided settings
      const audioBuffer = await elevenLabsService.generateSpeech(text, baseVoiceId, settings);
      
      // Set appropriate headers for audio
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length,
      });
      
      res.send(audioBuffer);
    } catch (error) {
      console.error("Error generating voice preview:", error);
      res.status(500).json({ message: "Failed to generate voice preview" });
    }
  });

  app.post("/api/voice-builder/save", isAuthenticated, async (req, res) => {
    try {
      const { name, description, category, tags, baseVoiceId, settings, addToMarketplace, sampleText } = req.body;
      const userId = req.user.id;
      
      console.log('Voice save request:', { userId, name, baseVoiceId, addToMarketplace }); // Debug log
      
      if (!name || !baseVoiceId) {
        console.log('Missing required fields:', { name, baseVoiceId }); // Debug log
        return res.status(400).json({ message: "Name and baseVoiceId are required" });
      }
      
      // Check subscription tier - voice builder requires Pro or higher
      const user = await storage.getUser(userId);
      const subscriptionTier = user?.subscriptionTier || 'free';
      const isPro = subscriptionTier === 'pro' || subscriptionTier === 'byok' || subscriptionTier === 'enterprise';
      
      console.log('User subscription check:', { userId, subscriptionTier, isPro }); // Debug log
      
      if (!isPro) {
        return res.status(403).json({ 
          message: "Voice Builder requires Pro subscription",
          upgrade: "Upgrade to Pro to access custom voice creation"
        });
      }
      
      // Create the custom voice object
      const customVoice = {
        id: randomUUID(),
        name: name.trim(),
        description: description ? description.trim() : "",
        category: category || "Custom",
        tags: tags && tags.length > 0 ? tags : ["custom"],
        voiceId: baseVoiceId, // Changed from baseVoiceId to voiceId to match frontend expectations
        baseVoiceId, // Keep this for backward compatibility
        settings: settings || {},
        sampleText: sampleText || "Sample text for this voice.",
        authorId: userId,
        createdAt: new Date().toISOString(),
        isActive: true
      };
      
      console.log('Created custom voice object:', customVoice); // Debug log
      
      // Always save to user's favorite voices (private library)
      const userSettings = await storage.getUserSettings(userId);
      const currentFavorites = userSettings?.favoriteVoices || [];
      const updatedFavorites = [...currentFavorites, customVoice];
      
      console.log('Updating user settings with voice:', { 
        userId, 
        currentFavoritesCount: currentFavorites.length,
        updatedFavoritesCount: updatedFavorites.length 
      }); // Debug log
      
      const updatedSettings = await storage.updateUserSettings(userId, {
        favoriteVoices: updatedFavorites
      });
      
      console.log('User settings updated successfully:', !!updatedSettings); // Debug log
      
      // If addToMarketplace is true, also save to marketplace
      if (addToMarketplace) {
        try {
                  const { firebaseMarketplaceService } = await import('./firebaseMarketplace');
        const marketplaceVoice = await firebaseMarketplaceService.createVoice({
            name: name.trim(),
            description: description ? description.trim() : "",
            category: category || "Custom",
            tags: tags && tags.length > 0 ? tags : ["custom"],
            voiceId: baseVoiceId,
            baseVoiceId,
            settings: settings || {},
            sampleText: sampleText || "Sample text for this voice.",
            authorId: userId,
            authorName: user?.firstName || user?.email || "Anonymous",
            isActive: true,
            isVerified: false,
            downloads: 0,
            upvotes: 0,
            downvotes: 0,
            moderationStatus: 'approved' // Auto-approve all marketplace uploads
          });
          console.log('Voice submitted to marketplace:', marketplaceVoice.id);
        } catch (error) {
          console.error('Failed to submit voice to marketplace:', error);
          // Don't fail the whole operation if marketplace submission fails
        }
      }
      
      res.json({ 
        success: true, 
        voice: customVoice,
        message: addToMarketplace 
          ? "Voice saved to your library and added to marketplace!" 
          : "Voice saved to your library!"
      });
    } catch (error) {
      console.error('Error saving custom voice:', error);
      res.status(500).json({ message: "Failed to save custom voice", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Billing and Subscription API routes
  
  // Get user's subscription status
  app.get("/api/billing/subscription", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const subscriptionTier = user.subscriptionTier || 'free';
      const isPro = subscriptionTier === 'pro' || subscriptionTier === 'byok' || subscriptionTier === 'enterprise';

      res.json({
        tier: subscriptionTier,
        status: user.subscriptionStatus || 'active',
        isPro,
        trialEndsAt: user.trialEndsAt,
        currentPeriodEnd: user.currentPeriodEnd,
      });
    } catch (error) {
      console.error("Error fetching subscription:", error);
      res.status(500).json({ message: "Failed to fetch subscription" });
    }
  });

  // Update user's subscription tier (for testing/admin purposes)
  app.put("/api/billing/subscription", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { tier, status = 'active' } = req.body;
      
      if (!tier || !['free', 'pro', 'byok', 'enterprise'].includes(tier)) {
        return res.status(400).json({ message: "Invalid subscription tier" });
      }

      // Get current user data
      const [currentUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));

      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if it's actually a change
      if (currentUser.subscriptionTier === tier) {
        return res.status(400).json({ message: "You're already on this plan" });
      }

      // Check plan change limits
      try {
        const { canChangePlan } = await import('@shared/billing');
        const changeResult = canChangePlan(
          currentUser.subscriptionTier as any,
          tier as any,
          currentUser.lastPlanChangeAt,
          currentUser.planChangeCount || 0
        );

        if (!changeResult.allowed) {
          return res.status(400).json({ 
            message: changeResult.reason || "Cannot change to this plan at this time",
            nextAllowedDate: changeResult.nextAllowedDate
          });
        }
      } catch (importError) {
        console.error("Failed to import billing functions:", importError);
        // Fallback: allow the change if import fails
        console.log("Allowing plan change due to import failure");
      }



      // Update user's subscription tier in database
      const [updatedUser] = await db
        .update(users)
        .set({ 
          subscriptionTier: tier,
          subscriptionStatus: status,
          lastPlanChangeAt: new Date(),
          planChangeCount: (currentUser.planChangeCount || 0) + 1,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId))
        .returning();

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const isPro = tier === 'pro' || tier === 'byok' || tier === 'enterprise';

      res.json({
        tier: updatedUser.subscriptionTier,
        status: updatedUser.subscriptionStatus,
        isPro,
        trialEndsAt: updatedUser.trialEndsAt,
        currentPeriodEnd: updatedUser.currentPeriodEnd,
        lastPlanChangeAt: updatedUser.lastPlanChangeAt,
        planChangeCount: updatedUser.planChangeCount,
        message: `Subscription updated to ${tier} tier`
      });
    } catch (error) {
      console.error("Error updating subscription:", error);
      res.status(500).json({ message: "Failed to update subscription" });
    }
  });

  // Create checkout session (Stripe integration)
  app.post("/api/billing/create-checkout", isAuthenticated, async (req: any, res) => {
    try {
      const { tier, interval } = req.body; // interval: 'month' or 'year'
      const userId = req.user.id;

      // TODO: Implement Stripe checkout session creation
      // For now, return a mock checkout URL
      const checkoutUrl = `https://checkout.stripe.com/pay/cs_test_${Math.random().toString(36).substring(2)}`;
      
      res.json({ 
        checkoutUrl,
        sessionId: `cs_test_${Math.random().toString(36).substring(2)}`
      });
    } catch (error) {
      console.error('Error creating checkout session:', error);
      res.status(500).json({ message: "Failed to create checkout session" });
    }
  });

  // API Key Management for BYOK tier
  
  // Get user's API keys
  app.get("/api/billing/api-keys", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user || user.subscriptionTier !== 'byok') {
        return res.status(403).json({ message: "BYOK subscription required" });
      }

      const apiKeys = await storage.getUserApiKeys(userId);
      
      // Don't return the actual API keys, just metadata
      const safeApiKeys = apiKeys.map(key => ({
        id: key.id,
        provider: key.provider,
        isActive: key.isActive,
        lastUsedAt: key.lastUsedAt,
        createdAt: key.createdAt
      }));

      res.json(safeApiKeys);
    } catch (error) {
      console.error('Error getting API keys:', error);
      res.status(500).json({ message: "Failed to get API keys" });
    }
  });

  // Save API keys
  app.post("/api/billing/api-keys", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { openai, elevenlabs } = req.body;
      const user = await storage.getUser(userId);
      
      if (!user || user.subscriptionTier !== 'byok') {
        return res.status(403).json({ message: "BYOK subscription required" });
      }

      const keysToSave = [];
      
      if (openai) {
        keysToSave.push({
          userId,
          provider: 'openai',
          apiKey: openai, // Will be encrypted in storage
          isActive: true
        });
      }
      
      if (elevenlabs) {
        keysToSave.push({
          userId,
          provider: 'elevenlabs',
          apiKey: elevenlabs, // Will be encrypted in storage
          isActive: true
        });
      }

      for (const keyData of keysToSave) {
        await storage.saveUserApiKey(keyData);
      }

      res.json({ success: true, message: "API keys saved successfully" });
    } catch (error) {
      console.error('Error saving API keys:', error);
      res.status(500).json({ message: "Failed to save API keys" });
    }
  });

  // Test API keys
  app.post("/api/billing/test-api-keys", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { openai, elevenlabs } = req.body;
      const user = await storage.getUser(userId);
      
      if (!user || user.subscriptionTier !== 'byok') {
        return res.status(403).json({ message: "BYOK subscription required" });
      }

      const results = { success: true, message: "All keys tested successfully" };

      // Test OpenAI key
      if (openai) {
        try {
          const testOpenAI = new OpenAI({ apiKey: openai });
          await testOpenAI.models.list();
        } catch (error) {
          results.success = false;
          results.message = "OpenAI API key is invalid";
          return res.json(results);
        }
      }

      // Test ElevenLabs key
      if (elevenlabs) {
        try {
          const response = await fetch('https://api.elevenlabs.io/v1/voices', {
            headers: {
              'xi-api-key': elevenlabs
            }
          });
          
          if (!response.ok) {
            results.success = false;
            results.message = "ElevenLabs API key is invalid";
            return res.json(results);
          }
        } catch (error) {
          results.success = false;
          results.message = "ElevenLabs API key is invalid";
          return res.json(results);
        }
      }

      res.json(results);
    } catch (error) {
      console.error('Error testing API keys:', error);
      res.status(500).json({ success: false, message: "Failed to test API keys" });
    }
  });

  // Delete API key
  app.delete("/api/billing/api-keys/:provider", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { provider } = req.params;
      const user = await storage.getUser(userId);
      
      if (!user || user.subscriptionTier !== 'byok') {
        return res.status(403).json({ message: "BYOK subscription required" });
      }

      await storage.deleteUserApiKey(userId, provider);
      
      res.json({ success: true, message: "API key deleted successfully" });
    } catch (error) {
      console.error('Error deleting API key:', error);
      res.status(500).json({ message: "Failed to delete API key" });
    }
  });

  // Get usage statistics
  app.get("/api/billing/usage", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      const subscriptionTier = user?.subscriptionTier || 'free';

      const tierConfig = getTierConfig(subscriptionTier as SubscriptionTier);
      const usage = await storage.getUsageTracking(userId, 'current');
      
      const usageData = {
        tier: subscriptionTier,
        limits: tierConfig.limits,
        current: {
          bantersGenerated: usage?.bantersGenerated || 0,
          openaiTokensUsed: usage?.openaiTokensUsed || 0,
          elevenlabsCharactersUsed: usage?.elevenlabsCharactersUsed || 0,
          audioMinutesGenerated: usage?.audioMinutesGenerated || 0
        },
        percentages: {
          bantersGenerated: tierConfig.limits.dailyBanters > 0 ? 
            Math.min((usage?.bantersGenerated || 0) / tierConfig.limits.dailyBanters * 100, 100) : 0,
          openaiTokensUsed: tierConfig.limits.openaiTokens > 0 ? 
            Math.min((usage?.openaiTokensUsed || 0) / tierConfig.limits.openaiTokens * 100, 100) : 0,
          elevenlabsCharactersUsed: tierConfig.limits.elevenlabsCharacters > 0 ? 
            Math.min((usage?.elevenlabsCharactersUsed || 0) / tierConfig.limits.elevenlabsCharacters * 100, 100) : 0
        }
      };

      res.json(usageData);
    } catch (error) {
      console.error('Error getting usage:', error);
      res.status(500).json({ message: "Failed to get usage data" });
    }
  });

  // Update usage tracking
  app.post("/api/billing/usage", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { bantersGenerated, openaiTokensUsed, elevenlabsCharactersUsed, audioMinutesGenerated } = req.body;
      
      await storage.updateUsageTracking(userId, {
        bantersGenerated,
        openaiTokensUsed,
        elevenlabsCharactersUsed,
        audioMinutesGenerated
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Error updating usage:', error);
      res.status(500).json({ message: "Failed to update usage" });
    }
  });

  // Webhook for Stripe events
  app.post("/api/billing/webhook", async (req: any, res) => {
    try {
      // TODO: Implement Stripe webhook handling
      // This would handle subscription events like:
      // - subscription.created
      // - subscription.updated
      // - subscription.deleted
      // - invoice.payment_succeeded
      // - invoice.payment_failed
      
      console.log('Stripe webhook received:', req.body);
      
      res.json({ received: true });
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  // Generate audio with ElevenLabs
  app.post("/api/elevenlabs/generate", isAuthenticated, async (req: any, res) => {
    try {
      const { text, voiceId } = req.body;
      const userId = req.user.id;
      
      const user = await storage.getUser(userId);
      const subscriptionTier = user?.subscriptionTier || 'free';
      const isPro = subscriptionTier === 'pro' || subscriptionTier === 'byok' || subscriptionTier === 'enterprise';
      
      if (!isPro) {
        return res.status(403).json({ 
          message: "ElevenLabs voices require Pro subscription",
          upgrade: "Upgrade to Pro to access premium voices"
        });
      }

      if (!text || !voiceId) {
        return res.status(400).json({ message: "Text and voiceId are required" });
      }

      const audioUrl = await elevenLabsService.generateSpeech(text, voiceId);
      res.json({ audioUrl });
    } catch (error) {
      console.error('Error generating ElevenLabs audio:', error);
      res.status(500).json({ message: "Failed to generate audio" });
    }
  });

  // Store API keys for BYOK users
  app.post("/api/settings/api-keys", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const { openai, elevenlabs } = req.body;
      
      if (!openai || !elevenlabs) {
        return res.status(400).json({ message: "Both OpenAI and ElevenLabs API keys are required" });
      }
      
      // Validate API key formats
      if (!openai.startsWith('sk-')) {
        return res.status(400).json({ message: "Invalid OpenAI API key format" });
      }
      
      // TODO: Add validation for ElevenLabs key format
      
      // Store API keys using storage service
      await storage.saveUserApiKey({ userId, provider: 'openai', apiKey: openai });
      await storage.saveUserApiKey({ userId, provider: 'elevenlabs', apiKey: elevenlabs });
      
      res.json({ 
        message: "API keys stored successfully",
        hasKeys: true
      });
    } catch (error) {
      console.error("Error storing API keys:", error);
      res.status(500).json({ message: "Failed to store API keys" });
    }
  });

  // Fix subscription status for pro users
  app.post("/api/billing/fix-subscription", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Get current user
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // If user has pro tier but inactive status, fix it
      if (user.subscriptionTier === 'pro' && user.subscriptionStatus !== 'active') {
        await db.update(users)
          .set({ 
            subscriptionStatus: 'active',
            updatedAt: new Date()
          })
          .where(eq(users.id, userId));
        
        console.log(`Fixed subscription status for user ${userId}: pro tier now active`);
        
        res.json({ 
          message: "Subscription status fixed",
          subscriptionTier: 'pro',
          subscriptionStatus: 'active'
        });
      } else {
        res.json({ 
          message: "No fix needed",
          subscriptionTier: user.subscriptionTier,
          subscriptionStatus: user.subscriptionStatus
        });
      }
    } catch (error) {
      console.error("Error fixing subscription:", error);
      res.status(500).json({ message: "Failed to fix subscription" });
    }
  });

  // Create Stripe checkout session for subscription upgrades
  app.post("/api/billing/create-checkout-session", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { tier, setupMode } = req.body;
      
      if (!tier || !['pro', 'byok'].includes(tier)) {
        return res.status(400).json({ message: "Invalid subscription tier" });
      }
      
      // TODO: Integrate with Stripe
      // For now, just update the user's subscription tier directly
      const [updatedUser] = await db
        .update(users)
        .set({ 
          subscriptionTier: tier,
          subscriptionStatus: 'active',
          updatedAt: new Date()
        })
        .where(eq(users.id, userId))
        .returning();
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // TODO: Replace with actual Stripe checkout URL
      const checkoutUrl = `/dashboard?upgraded=${tier}`;
      
      res.json({
        url: checkoutUrl,
        tier: updatedUser.subscriptionTier,
        message: `Successfully upgraded to ${tier} tier`
      });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ message: "Failed to create checkout session" });
    }
  });

  // Register marketplace endpoints
  const { registerMarketplaceEndpoints } = await import('./marketplace-endpoints');
  registerMarketplaceEndpoints(app);

  return httpServer;
}

/**
 * Detects if a message is a direct question about recent events or what BanterBox said
 */
function isDirectQuestion(message: string): boolean {
  if (!message) return false;
  
  const lowerMessage = message.toLowerCase();
  
  // Direct question patterns about recent events
  const directQuestionPatterns = [
    /what just happened/i,
    /what happened/i,
    /what did you say/i,
    /what did banterbox say/i,
    /what was that/i,
    /what did i miss/i,
    /what's going on/i,
    /what's happening/i,
    /can you repeat that/i,
    /what did you mean/i,
    /what was the last thing/i,
    /what did we just talk about/i,
    /what was the conversation about/i,
    /what did someone say/i,
    /who said what/i,
    /what was the message/i,
    /what did they say/i,
    /what was the response/i,
    /what did you respond/i,
    /what was your answer/i
  ];
  
  // Check if message matches any direct question pattern
  return directQuestionPatterns.some(pattern => pattern.test(lowerMessage));
}

/**
 * Applies response frequency filtering based on user settings
 */
function applyResponseFrequencyFilter(responseFrequency: number, responseReason: string, originalMessage: string): boolean {
  // Always respond to direct mentions regardless of frequency setting
  if (responseReason === 'direct mention') {
    return true;
  }

  // Generate a random number between 0 and 100
  const randomValue = Math.random() * 100;
  
  // If random value is less than response frequency, allow the response
  const shouldRespond = randomValue <= responseFrequency;
  
  console.log(`Response frequency check: ${randomValue.toFixed(1)} <= ${responseFrequency} = ${shouldRespond} (reason: ${responseReason})`);
  
  return shouldRespond;
}

/**
 * Builds a factual response prompt for direct questions
 */
function buildFactualResponsePrompt(
  question: string,
  contextString: string,
  eventType: EventType,
  eventData: EventData
): string {
  let prompt = `Question: "${question}"\n\n`;
  
  if (contextString) {
    prompt += `Recent context:\n${contextString}\n\n`;
  }
  
  prompt += `Current event: ${eventType}`;
  if (eventData.username) {
    prompt += ` from ${eventData.username}`;
  }
  if (eventData.message) {
    prompt += ` - "${eventData.message}"`;
  }
  if (eventData.messageContent) {
    prompt += ` - "${eventData.messageContent}"`;
  }
  
  prompt += `\n\nPlease provide a factual answer to the question based on the context and current event. If you don't have enough information, say so.`;
  
  return prompt;
}
