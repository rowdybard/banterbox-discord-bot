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

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  passwordHash: varchar("password_hash"), // For local authentication
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  subscriptionTier: text("subscription_tier").default("free"), // 'free', 'pro', 'byok', 'enterprise'
  subscriptionStatus: text("subscription_status").default("active"), // 'active', 'canceled', 'past_due', 'trialing'
  subscriptionId: varchar("subscription_id"), // External subscription ID (Stripe, etc.)
  trialEndsAt: timestamp("trial_ends_at"),
  currentPeriodEnd: timestamp("current_period_end"),
  lastPlanChangeAt: timestamp("last_plan_change_at"), // Track when user last changed plans
  planChangeCount: integer("plan_change_count").default(0), // Track number of plan changes
  hasCompletedOnboarding: boolean("has_completed_onboarding").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// API Keys for "Bring Your Own Key" tier
export const userApiKeys = pgTable("user_api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  provider: text("provider").notNull(), // 'openai', 'elevenlabs'
  apiKey: text("api_key").notNull(), // Encrypted API key
  isActive: boolean("is_active").default(true),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Billing information
export const billingInfo = pgTable("billing_info", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  customerId: varchar("customer_id"), // External customer ID (Stripe, etc.)
  name: varchar("name"),
  email: varchar("email"),
  address: jsonb("address"), // Billing address
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Usage tracking for billing
export const usageTracking = pgTable("usage_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  date: text("date").notNull(), // YYYY-MM-DD format
  bantersGenerated: integer("banters_generated").default(0),
  openaiTokensUsed: integer("openai_tokens_used").default(0),
  elevenlabsCharactersUsed: integer("elevenlabs_characters_used").default(0),
  audioMinutesGenerated: integer("audio_minutes_generated").default(0),
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
  banterPersonality: text("banter_personality").default("context"),
  customPersonalityPrompt: text("custom_personality_prompt"),
  favoritePersonalities: jsonb("favorite_personalities").default([]), // Array of saved personality objects
  favoriteVoices: jsonb("favorite_voices").default([]), // Array of saved voice objects
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
  personality: varchar("personality").default("context"),
  voiceProvider: varchar("voice_provider").default("openai"),
  enabledEvents: text("enabled_events").array().default(['discord_message', 'discord_member_join', 'discord_reaction']),
  currentStreamer: varchar("current_streamer"), // Discord user ID of active streamer
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Context Memory - stores conversation history and events for better AI responses
export const contextMemory = pgTable("context_memory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  guildId: varchar("guild_id"), // For Discord context
  eventType: varchar("event_type").notNull(), // 'discord_message', 'chat', etc.
  eventData: jsonb("event_data"), // Full event details
  contextSummary: text("context_summary").notNull(), // Human-readable summary for AI
  originalMessage: text("original_message"), // The actual message content
  banterResponse: text("banter_response"), // AI's response (if any)
  importance: integer("importance").default(1), // 1-10 scale for relevance
  participants: text("participants").array().default([]), // User IDs involved
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
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

export const insertGuildSettingsSchema = createInsertSchema(guildSettings);

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

// New Discord bot types
export type InsertLinkCode = z.infer<typeof insertLinkCodeSchema>;
export type LinkCode = typeof linkCodes.$inferSelect;

export type InsertGuildLink = z.infer<typeof insertGuildLinkSchema>;
export type GuildLink = typeof guildLinks.$inferSelect;

export type InsertGuildSettings = z.infer<typeof insertGuildSettingsSchema>;
export type GuildSettings = typeof guildSettings.$inferSelect;

export const insertContextMemorySchema = createInsertSchema(contextMemory).omit({
  id: true,
  createdAt: true,
});

export type InsertContextMemory = z.infer<typeof insertContextMemorySchema>;
export type ContextMemory = typeof contextMemory.$inferSelect;

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
