import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (supports both local and OAuth authentication)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  password: varchar("password"), // For local auth (null for OAuth users)
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  isPro: boolean("is_pro").default(false),
  hasCompletedOnboarding: boolean("has_completed_onboarding").default(false),
  authProvider: varchar("auth_provider").default("local"), // 'local' or 'google'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const banterItems = pgTable("banter_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  originalMessage: text("original_message"),
  banterText: text("banter_text").notNull(),
  eventType: text("event_type").notNull(), // 'chat', 'subscription', 'donation', 'raid'
  eventData: jsonb("event_data"), // Additional event information
  audioUrl: text("audio_url"),
  isPlayed: boolean("is_played").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userSettings = pgTable("user_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).unique(),
  voiceProvider: text("voice_provider").default("openai"), // 'openai', 'elevenlabs'
  voiceId: text("voice_id"),
  autoPlay: boolean("auto_play").default(true),
  volume: integer("volume").default(75),
  enabledEvents: jsonb("enabled_events").default(['chat']),
  overlayPosition: text("overlay_position").default("bottom-center"),
  overlayDuration: integer("overlay_duration").default(12),
  overlayAnimation: text("overlay_animation").default("fade"),
  banterPersonality: text("banter_personality").default("witty"),
  customPersonalityPrompt: text("custom_personality_prompt"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const dailyStats = pgTable("daily_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  date: text("date").notNull(), // YYYY-MM-DD format
  bantersGenerated: integer("banters_generated").default(0),
  bantersPlayed: integer("banters_played").default(0),
  chatResponses: integer("chat_responses").default(0),
  audioGenerated: integer("audio_generated").default(0), // in seconds
  viewerEngagement: integer("viewer_engagement").default(0), // percentage
  peakHour: integer("peak_hour"), // Hour of day (0-23) with most activity
});

// Custom voices table
export const customVoices = pgTable("custom_voices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  name: text("name").notNull(),
  baseVoiceId: text("base_voice_id").notNull(),
  settings: jsonb("settings").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Voice marketplace table
export const voiceMarketplace = pgTable("voice_marketplace", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  authorId: varchar("author_id").references(() => users.id),
  name: text("name").notNull(),
  description: text("description").notNull(),
  baseVoiceId: text("base_voice_id").notNull(),
  settings: jsonb("settings").notNull(),
  sampleText: text("sample_text").notNull(),
  category: text("category").default("Custom"),
  tags: text("tags").array(),
  downloads: integer("downloads").default(0),
  upvotes: integer("upvotes").default(0),
  downvotes: integer("downvotes").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Voice marketplace votes
export const voiceVotes = pgTable("voice_votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  voiceId: varchar("voice_id").references(() => voiceMarketplace.id),
  userId: varchar("user_id").references(() => users.id),
  voteType: text("vote_type").notNull(), // 'upvote' | 'downvote'
  createdAt: timestamp("created_at").defaultNow(),
});

// Voice marketplace downloads
export const voiceDownloads = pgTable("voice_downloads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  voiceId: varchar("voice_id").references(() => voiceMarketplace.id),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Custom personality marketplace
export const personalityMarketplace = pgTable("personality_marketplace", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  prompt: text("prompt").notNull(),
  category: text("category").notNull(), // 'gaming', 'music', 'comedy', 'educational', 'custom'
  tags: jsonb("tags").default([]),
  authorId: varchar("author_id").references(() => users.id),
  authorName: text("author_name").notNull(),
  isVerified: boolean("is_verified").default(false), // Staff verified quality personalities
  downloads: integer("downloads").default(0),
  upvotes: integer("upvotes").default(0),
  downvotes: integer("downvotes").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User votes on marketplace personalities
export const personalityVotes = pgTable("personality_votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  personalityId: varchar("personality_id").references(() => personalityMarketplace.id),
  userId: varchar("user_id").references(() => users.id),
  voteType: text("vote_type").notNull(), // 'upvote' or 'downvote'
  createdAt: timestamp("created_at").defaultNow(),
});

// User downloads of marketplace personalities
export const personalityDownloads = pgTable("personality_downloads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  personalityId: varchar("personality_id").references(() => personalityMarketplace.id),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Context memory for AI to remember recent stream events
export const contextMemory = pgTable("context_memory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  guildId: varchar("guild_id"), // For Discord context
  eventType: text("event_type").notNull(), // 'chat', 'subscription', 'donation', 'raid', 'join', 'reaction'
  eventData: jsonb("event_data"), // Event details (username, amount, message, etc.)
  contextSummary: text("context_summary"), // AI-friendly summary of the event
  importance: integer("importance").default(1), // 1-10 scale for context relevance
  expiresAt: timestamp("expires_at").notNull(), // When this memory should expire
  createdAt: timestamp("created_at").defaultNow(),
});

// Twitch integration settings
export const twitchSettings = pgTable("twitch_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  accessToken: varchar("access_token"),
  refreshToken: varchar("refresh_token"),
  twitchUsername: varchar("twitch_username"),
  twitchUserId: varchar("twitch_user_id"),
  isConnected: boolean("is_connected").default(false),
  enabledEvents: text("enabled_events").array().default(['chat', 'subscribe', 'cheer', 'raid', 'follow']),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Discord Link Codes - for connecting BanterBox workspaces to Discord guilds
export const linkCodes = pgTable("link_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 8 }).notNull().unique(),
  workspaceId: varchar("workspace_id").notNull(), // BanterBox user ID
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  consumedAt: timestamp("consumed_at"),
});

// Discord Guild Links - stores which Discord servers are linked to BanterBox workspaces
export const guildLinks = pgTable("guild_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  guildId: varchar("guild_id").notNull().unique(),
  workspaceId: varchar("workspace_id").notNull(), // BanterBox user ID
  linkedByUserId: varchar("linked_by_user_id").notNull(), // Discord user who ran /link
  createdAt: timestamp("created_at").defaultNow(),
  active: boolean("active").default(true),
});

// Discord Guild Settings - per-guild configuration
export const guildSettings = pgTable("guild_settings", {
  guildId: varchar("guild_id").primaryKey(),
  workspaceId: varchar("workspace_id").notNull(),
  personality: varchar("personality").default("sarcastic"),
  voiceProvider: varchar("voice_provider").default("openai"),
  enabledEvents: text("enabled_events").array().default(['discord_message', 'discord_member_join', 'discord_reaction']),
  currentStreamer: varchar("current_streamer"), // Discord user ID of active streamer
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Legacy Discord settings (will be removed after migration)
export const discordSettings = pgTable("discord_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  discordUserId: varchar("discord_user_id"),
  discordUsername: varchar("discord_username"),
  discordTag: varchar("discord_tag"), // username#discriminator
  accessToken: varchar("access_token"),
  refreshToken: varchar("refresh_token"),
  isConnected: boolean("is_connected").default(false),
  enabledEvents: text("enabled_events").array().default(['discord_message', 'discord_member_join', 'discord_reaction']),
  connectedGuilds: jsonb("connected_guilds"), // Array of guild IDs and names
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const upsertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertBanterItemSchema = createInsertSchema(banterItems).omit({
  id: true,
  createdAt: true,
});

export const insertUserSettingsSchema = createInsertSchema(userSettings).omit({
  id: true,
  updatedAt: true,
});

// New Discord bot schemas
export const insertLinkCodeSchema = createInsertSchema(linkCodes).omit({
  id: true,
  createdAt: true,
});

export const insertGuildLinkSchema = createInsertSchema(guildLinks).omit({
  id: true,
  createdAt: true,
});

export const insertGuildSettingsSchema = createInsertSchema(guildSettings).extend({
  enabledEvents: z.array(z.string()).optional()
});

// Legacy Discord settings schema (to be removed)
export const insertDiscordSettingsSchema = createInsertSchema(discordSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDailyStatsSchema = createInsertSchema(dailyStats).omit({
  id: true,
});

export const insertTwitchSettingsSchema = createInsertSchema(twitchSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Context memory schema
export const insertContextMemorySchema = createInsertSchema(contextMemory).omit({
  id: true,
  createdAt: true,
});

// Marketplace schemas
export const insertPersonalityMarketplaceSchema = createInsertSchema(personalityMarketplace).omit({
  id: true,
  downloads: true,
  upvotes: true,
  downvotes: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPersonalityVoteSchema = createInsertSchema(personalityVotes).omit({
  id: true,
  createdAt: true,
});

export const insertPersonalityDownloadSchema = createInsertSchema(personalityDownloads).omit({
  id: true,
  createdAt: true,
});

// Custom voices schema
export const insertCustomVoiceSchema = createInsertSchema(customVoices).omit({
  id: true,
  createdAt: true,
});

// Voice marketplace schemas
export const insertVoiceMarketplaceSchema = createInsertSchema(voiceMarketplace).omit({
  id: true,
  downloads: true,
  upvotes: true,
  downvotes: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVoiceVoteSchema = createInsertSchema(voiceVotes).omit({
  id: true,
  createdAt: true,
});

export const insertVoiceDownloadSchema = createInsertSchema(voiceDownloads).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertBanterItem = z.infer<typeof insertBanterItemSchema>;
export type BanterItem = typeof banterItems.$inferSelect;

export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UserSettings = typeof userSettings.$inferSelect;

export type InsertDailyStats = z.infer<typeof insertDailyStatsSchema>;
export type DailyStats = typeof dailyStats.$inferSelect;

export type InsertTwitchSettings = z.infer<typeof insertTwitchSettingsSchema>;
export type TwitchSettings = typeof twitchSettings.$inferSelect;

// Context memory types
export type InsertContextMemory = z.infer<typeof insertContextMemorySchema>;
export type ContextMemory = typeof contextMemory.$inferSelect;

// Marketplace types
export type InsertPersonalityMarketplace = z.infer<typeof insertPersonalityMarketplaceSchema>;
export type PersonalityMarketplace = typeof personalityMarketplace.$inferSelect;

export type InsertPersonalityVote = z.infer<typeof insertPersonalityVoteSchema>;
export type PersonalityVote = typeof personalityVotes.$inferSelect;

export type InsertPersonalityDownload = z.infer<typeof insertPersonalityDownloadSchema>;
export type PersonalityDownload = typeof personalityDownloads.$inferSelect;

// Custom voice types
export type InsertCustomVoice = z.infer<typeof insertCustomVoiceSchema>;
export type CustomVoice = typeof customVoices.$inferSelect;

// Voice marketplace types
export type InsertVoiceMarketplace = z.infer<typeof insertVoiceMarketplaceSchema>;
export type VoiceMarketplace = typeof voiceMarketplace.$inferSelect;

export type InsertVoiceVote = z.infer<typeof insertVoiceVoteSchema>;
export type VoiceVote = typeof voiceVotes.$inferSelect;

export type InsertVoiceDownload = z.infer<typeof insertVoiceDownloadSchema>;
export type VoiceDownload = typeof voiceDownloads.$inferSelect;

// New Discord bot types
export type InsertLinkCode = z.infer<typeof insertLinkCodeSchema>;
export type LinkCode = typeof linkCodes.$inferSelect;

export type InsertGuildLink = z.infer<typeof insertGuildLinkSchema>;
export type GuildLink = typeof guildLinks.$inferSelect;

export type InsertGuildSettings = z.infer<typeof insertGuildSettingsSchema>;
export type GuildSettings = typeof guildSettings.$inferSelect;

// Legacy Discord types (to be removed)
export type InsertDiscordSettings = z.infer<typeof insertDiscordSettingsSchema>;
export type DiscordSettings = typeof discordSettings.$inferSelect;

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
