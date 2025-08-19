import { z } from "zod";

// Firebase-compatible schema definitions
// These are TypeScript interfaces that match the Firebase document structure

// Session storage interface (for session management)
export interface Session {
  sid: string;
  sess: any;
  expire: Date;
}

// User interface
export interface User {
  id: string;
  email?: string;
  passwordHash?: string; // For local authentication
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  subscriptionTier: 'free' | 'pro' | 'byok' | 'enterprise';
  subscriptionStatus: 'active' | 'canceled' | 'past_due' | 'trialing';
  subscriptionId?: string; // External subscription ID (Stripe, etc.)
  trialEndsAt?: Date;
  currentPeriodEnd?: Date;
  lastPlanChangeAt?: Date; // Track when user last changed plans
  planChangeCount: number; // Track number of plan changes
  hasCompletedOnboarding: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// API Keys for "Bring Your Own Key" tier
export interface UserApiKey {
  id: string;
  userId: string;
  provider: 'openai' | 'elevenlabs';
  apiKey: string; // Encrypted API key
  isActive: boolean;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Billing information
export interface BillingInfo {
  id: string;
  userId: string;
  customerId?: string; // External customer ID (Stripe, etc.)
  name?: string;
  email?: string;
  address?: any; // Billing address
  createdAt: Date;
  updatedAt: Date;
}

// Usage tracking for billing
export interface UsageTracking {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD format
  bantersGenerated: number;
  openaiTokensUsed: number;
  elevenlabsCharactersUsed: number;
  audioMinutesGenerated: number;
  createdAt: Date;
  updatedAt: Date;
}

// Banter items
export interface BanterItem {
  id: string;
  userId?: string;
  originalMessage?: string;
  banterText: string;
  eventType: EventType;
  eventData?: EventData;
  audioUrl?: string;
  isPlayed: boolean;
  createdAt: Date;
}

// User settings
export interface UserSettings {
  id: string;
  userId: string;
  voiceProvider: 'openai' | 'elevenlabs';
  voiceId?: string;
  autoPlay: boolean;
  volume: number;
  responseFrequency: number; // 0-100 scale for response frequency
  enabledEvents: string[];
  overlayPosition: string;
  overlayDuration: number;
  overlayAnimation: string;
  banterPersonality: string;
  customPersonalityPrompt?: string;
  favoritePersonalities: any[]; // Array of saved personality objects
  favoriteVoices: any[]; // Array of saved voice objects
  updatedAt: Date;
}

// Daily stats
export interface DailyStats {
  id: string;
  userId?: string;
  date: string; // YYYY-MM-DD format
  bantersGenerated: number;
  bantersPlayed: number;
  chatResponses: number;
  audioGenerated: number; // in seconds
  viewerEngagement: number; // percentage
  peakHour?: number; // Hour of day (0-23) with most activity
}

// Twitch integration settings
export interface TwitchSettings {
  id: string;
  userId: string;
  accessToken?: string;
  refreshToken?: string;
  twitchUsername?: string;
  twitchUserId?: string;
  isConnected: boolean;
  enabledEvents: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Discord Link Codes - for connecting BanterBox workspaces to Discord guilds
export interface LinkCode {
  id: string;
  code: string;
  workspaceId: string; // BanterBox user ID
  createdAt: Date;
  expiresAt: Date;
  consumedAt?: Date;
}

// Discord Guild Links - stores which Discord servers are linked to BanterBox workspaces
export interface GuildLink {
  id: string;
  guildId: string;
  workspaceId: string; // BanterBox user ID
  linkedByUserId: string; // Discord user who ran /link
  createdAt: Date;
  active: boolean;
}

// Discord Guild Settings - per-guild configuration
export interface GuildSettings {
  guildId: string;
  workspaceId: string;
  personality: string;
  voiceProvider: string;
  enabledEvents: string[];
  currentStreamer?: string; // Discord user ID of active streamer
  updatedAt: Date;
}

// Context Memory - stores conversation history and events for better AI responses
export interface ContextMemory {
  id: string;
  userId?: string;
  guildId?: string; // For Discord context
  eventType: string; // 'discord_message', 'chat', etc.
  eventData?: any; // Full event details
  contextSummary: string; // Human-readable summary for AI
  originalMessage?: string; // The actual message content
  banterResponse?: string; // AI's response (if any)
  importance: number; // 1-10 scale for relevance
  participants: string[]; // User IDs involved
  createdAt: Date;
  expiresAt: Date;
}

// Marketplace Voices - public voice marketplace
export interface MarketplaceVoice {
  id: string;
  name: string;
  description?: string;
  category: string;
  tags: string[];
  voiceId: string; // ElevenLabs voice ID
  baseVoiceId?: string; // For backward compatibility
  settings: any; // Voice settings (stability, similarity, etc.)
  sampleText?: string;
  sampleAudioUrl?: string;
  authorId: string;
  authorName: string;
  isVerified: boolean;
  isActive: boolean;
  downloads: number;
  upvotes: number;
  downvotes: number;
  createdAt: Date;
  updatedAt: Date;
  moderationStatus: 'pending' | 'approved' | 'rejected';
  moderationNotes?: string;
  moderatedAt?: Date;
  moderatedBy?: string;
}

// Marketplace Personalities - public personality marketplace
export interface MarketplacePersonality {
  id: string;
  name: string;
  description?: string;
  prompt: string; // The actual personality prompt
  category: string;
  tags: string[];
  authorId: string;
  authorName: string;
  isVerified: boolean;
  isActive: boolean;
  downloads: number;
  upvotes: number;
  downvotes: number;
  createdAt: Date;
  updatedAt: Date;
  moderationStatus: 'pending' | 'approved' | 'rejected';
  moderationNotes?: string;
  moderatedAt?: Date;
  moderatedBy?: string;
}

// User Downloads - track what users have downloaded
export interface UserDownload {
  id: string;
  userId: string;
  itemType: 'voice' | 'personality';
  itemId: string; // ID from marketplace_voices or marketplace_personalities
  downloadedAt: Date;
}

// User Ratings - track user ratings for marketplace items
export interface UserRating {
  id: string;
  userId: string;
  itemType: 'voice' | 'personality';
  itemId: string;
  rating: number; // 1 for upvote, -1 for downvote
  createdAt: Date;
  updatedAt: Date;
}

// Reports - for flagging inappropriate content
export interface ContentReport {
  id: string;
  reporterId: string;
  itemType: 'voice' | 'personality';
  itemId: string;
  reason: 'inappropriate' | 'offensive' | 'spam' | 'copyright' | 'other';
  description?: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  reviewedBy?: string;
  reviewNotes?: string;
  createdAt: Date;
  reviewedAt?: Date;
}

// Legacy Discord settings (will be removed after migration)
export interface DiscordSettings {
  id: string;
  userId: string;
  discordUserId?: string;
  discordUsername?: string;
  discordTag?: string; // username#discriminator
  accessToken?: string;
  refreshToken?: string;
  isConnected: boolean;
  enabledEvents: string[];
  connectedGuilds?: any; // Array of guild IDs and names
  createdAt: Date;
  updatedAt: Date;
}

// Zod schemas for validation
export const userSchema = z.object({
  id: z.string(),
  email: z.string().email().optional(),
  passwordHash: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  profileImageUrl: z.string().optional(),
  subscriptionTier: z.enum(['free', 'pro', 'byok', 'enterprise']).default('free'),
  subscriptionStatus: z.enum(['active', 'canceled', 'past_due', 'trialing']).default('active'),
  subscriptionId: z.string().optional(),
  trialEndsAt: z.date().optional(),
  currentPeriodEnd: z.date().optional(),
  lastPlanChangeAt: z.date().optional(),
  planChangeCount: z.number().default(0),
  hasCompletedOnboarding: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const banterItemSchema = z.object({
  id: z.string(),
  userId: z.string().optional(),
  originalMessage: z.string().optional(),
  banterText: z.string(),
  eventType: z.enum(['chat', 'subscription', 'donation', 'raid', 'discord_message', 'discord_member_join', 'discord_reaction']),
  eventData: z.any().optional(),
  audioUrl: z.string().optional(),
  isPlayed: z.boolean().default(false),
  createdAt: z.date(),
});

export const userSettingsSchema = z.object({
  id: z.string(),
  userId: z.string(),
  voiceProvider: z.enum(['openai', 'elevenlabs']).default('openai'),
  voiceId: z.string().optional(),
  autoPlay: z.boolean().default(true),
  volume: z.number().default(75),
  responseFrequency: z.number().default(50),
  enabledEvents: z.array(z.string()).default(['chat']),
  overlayPosition: z.string().default('bottom-center'),
  overlayDuration: z.number().default(12),
  overlayAnimation: z.string().default('fade'),
  banterPersonality: z.string().default('context'),
  customPersonalityPrompt: z.string().optional(),
  favoritePersonalities: z.array(z.any()).default([]),
  favoriteVoices: z.array(z.any()).default([]),
  updatedAt: z.date(),
});

// Insert schemas (for creating new records)
export const insertUserSchema = userSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const upsertUserSchema = userSchema.omit({
  createdAt: true,
  updatedAt: true,
});

export const insertBanterItemSchema = banterItemSchema.omit({
  id: true,
  createdAt: true,
});

export const insertUserSettingsSchema = userSettingsSchema.omit({
  id: true,
  updatedAt: true,
});

// New Discord bot schemas
export const insertLinkCodeSchema = z.object({
  code: z.string(),
  workspaceId: z.string(),
  expiresAt: z.date(),
});

export const insertGuildLinkSchema = z.object({
  guildId: z.string(),
  workspaceId: z.string(),
  linkedByUserId: z.string(),
  active: z.boolean().default(true),
});

export const insertGuildSettingsSchema = z.object({
  guildId: z.string(),
  workspaceId: z.string(),
  personality: z.string().default('context'),
  voiceProvider: z.string().default('openai'),
  enabledEvents: z.array(z.string()).default(['discord_message', 'discord_member_join', 'discord_reaction']),
  currentStreamer: z.string().optional(),
  updatedAt: z.date(),
});

// Legacy Discord settings schema (to be removed)
export const insertDiscordSettingsSchema = z.object({
  userId: z.string(),
  discordUserId: z.string().optional(),
  discordUsername: z.string().optional(),
  discordTag: z.string().optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  isConnected: z.boolean().default(false),
  enabledEvents: z.array(z.string()).default(['discord_message', 'discord_member_join', 'discord_reaction']),
  connectedGuilds: z.any().optional(),
});

export const insertDailyStatsSchema = z.object({
  userId: z.string().optional(),
  date: z.string(),
  bantersGenerated: z.number().default(0),
  bantersPlayed: z.number().default(0),
  chatResponses: z.number().default(0),
  audioGenerated: z.number().default(0),
  viewerEngagement: z.number().default(0),
  peakHour: z.number().optional(),
});

export const insertTwitchSettingsSchema = z.object({
  userId: z.string(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  twitchUsername: z.string().optional(),
  twitchUserId: z.string().optional(),
  isConnected: z.boolean().default(false),
  enabledEvents: z.array(z.string()).default(['chat', 'subscribe', 'cheer', 'raid', 'follow']),
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = z.infer<typeof upsertUserSchema>;

export type InsertBanterItem = z.infer<typeof insertBanterItemSchema>;

export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;

export type InsertDailyStats = z.infer<typeof insertDailyStatsSchema>;

export type InsertTwitchSettings = z.infer<typeof insertTwitchSettingsSchema>;

// New Discord bot types
export type InsertLinkCode = z.infer<typeof insertLinkCodeSchema>;

export type InsertGuildLink = z.infer<typeof insertGuildLinkSchema>;

export type InsertGuildSettings = z.infer<typeof insertGuildSettingsSchema>;

export const insertContextMemorySchema = z.object({
  userId: z.string().optional(),
  guildId: z.string().optional(),
  eventType: z.string(),
  eventData: z.any().optional(),
  contextSummary: z.string(),
  originalMessage: z.string().optional(),
  banterResponse: z.string().optional(),
  importance: z.number().default(1),
  participants: z.array(z.string()).default([]),
  expiresAt: z.date(),
});

export type InsertContextMemory = z.infer<typeof insertContextMemorySchema>;

// Marketplace schemas
export const insertMarketplaceVoiceSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  category: z.string(),
  tags: z.array(z.string()).default([]),
  voiceId: z.string(),
  baseVoiceId: z.string().optional(),
  settings: z.any(),
  sampleText: z.string().optional(),
  sampleAudioUrl: z.string().optional(),
  authorId: z.string(),
  authorName: z.string(),
  isVerified: z.boolean().default(false),
  isActive: z.boolean().default(true),
  moderationStatus: z.enum(['pending', 'approved', 'rejected']).default('pending'),
  moderationNotes: z.string().optional(),
});

export const insertMarketplacePersonalitySchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  prompt: z.string(),
  category: z.string(),
  tags: z.array(z.string()).default([]),
  authorId: z.string(),
  authorName: z.string(),
  isVerified: z.boolean().default(false),
  isActive: z.boolean().default(true),
  moderationStatus: z.enum(['pending', 'approved', 'rejected']).default('pending'),
  moderationNotes: z.string().optional(),
});

export const insertUserDownloadSchema = z.object({
  userId: z.string(),
  itemType: z.enum(['voice', 'personality']),
  itemId: z.string(),
});

export const insertUserRatingSchema = z.object({
  userId: z.string(),
  itemType: z.enum(['voice', 'personality']),
  itemId: z.string(),
  rating: z.number(), // 1 for upvote, -1 for downvote
});

export const insertContentReportSchema = z.object({
  reporterId: z.string(),
  itemType: z.enum(['voice', 'personality']),
  itemId: z.string(),
  reason: z.enum(['inappropriate', 'offensive', 'spam', 'copyright', 'other']),
  description: z.string().optional(),
});

// Marketplace types
export type InsertMarketplaceVoice = z.infer<typeof insertMarketplaceVoiceSchema>;

export type InsertMarketplacePersonality = z.infer<typeof insertMarketplacePersonalitySchema>;

export type InsertUserDownload = z.infer<typeof insertUserDownloadSchema>;

export type InsertUserRating = z.infer<typeof insertUserRatingSchema>;

export type InsertContentReport = z.infer<typeof insertContentReportSchema>;

// Legacy Discord types (to be removed)
export type InsertDiscordSettings = z.infer<typeof insertDiscordSettingsSchema>;

// Event types
export type EventType = 'chat' | 'subscription' | 'donation' | 'raid' | 'discord_message' | 'discord_member_join' | 'discord_reaction';

export type EventData = {
  username?: string;
  amount?: number;
  message?: string;
  subscriberCount?: number;
  raiderCount?: number;
  // Discord specific
  displayName?: string;
  guildId?: string;
  guildName?: string;
  channelId?: string;
  messageId?: string;
  emoji?: string;
  messageContent?: string;
  [key: string]: any;
};
