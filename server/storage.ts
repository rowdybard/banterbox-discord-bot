import { type User, type InsertUser, type UpsertUser, type BanterItem, type InsertBanterItem, type UserSettings, type InsertUserSettings, type DailyStats, type InsertDailyStats, type TwitchSettings, type InsertTwitchSettings, type DiscordSettings, type InsertDiscordSettings, type LinkCode, type InsertLinkCode, type GuildLink, type InsertGuildLink, type GuildSettings, type InsertGuildSettings, type ContextMemory, type InsertContextMemory, type EventType, type EventData, type MarketplaceVoice, type InsertMarketplaceVoice, type MarketplacePersonality, type InsertMarketplacePersonality, type UserDownload, type InsertUserDownload, type UserRating, type InsertUserRating, type ContentReport, type InsertContentReport, users, banterItems, userSettings, dailyStats, twitchSettings, discordSettings, linkCodes, guildLinks, guildSettings, contextMemory, marketplaceVoices, marketplacePersonalities, userDownloads, userRatings, contentReports } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";

export interface IStorage {
  // User methods (required for Local Auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  completeOnboarding(userId: string): Promise<User>;
  
  // Legacy user methods for backward compatibility
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Banter methods
  getBanterItem(id: string): Promise<BanterItem | undefined>;
  getBantersByUser(userId: string, limit?: number): Promise<BanterItem[]>;
  searchBanters(userId: string, query: string, eventType: string, limit?: number): Promise<BanterItem[]>;
  createBanterItem(banter: InsertBanterItem): Promise<BanterItem>;
  updateBanterItem(id: string, updates: Partial<BanterItem>): Promise<BanterItem | undefined>;
  deleteBanterItem(id: string): Promise<boolean>;

  // Settings methods
  getUserSettings(userId: string): Promise<UserSettings | undefined>;
  createUserSettings(settings: InsertUserSettings): Promise<UserSettings>;
  updateUserSettings(userId: string, updates: Partial<UserSettings>): Promise<UserSettings | undefined>;

  // Stats methods
  getDailyStats(userId: string, date: string): Promise<DailyStats | undefined>;
  createDailyStats(stats: InsertDailyStats): Promise<DailyStats>;
  updateDailyStats(userId: string, date: string, updates: Partial<DailyStats>): Promise<DailyStats | undefined>;
  checkAndIncrementDailyUsage(userId: string): Promise<{ allowed: boolean; current: number; limit: number; isPro: boolean }>;

  // Twitch methods
  getTwitchSettings(userId: string): Promise<TwitchSettings | undefined>;
  upsertTwitchSettings(settings: InsertTwitchSettings): Promise<TwitchSettings>;
  updateTwitchEventSettings(userId: string, enabledEvents: string[]): Promise<TwitchSettings | undefined>;

  // Discord methods (legacy - to be removed)
  getDiscordSettings(userId: string): Promise<DiscordSettings | undefined>;
  upsertDiscordSettings(settings: InsertDiscordSettings): Promise<DiscordSettings>;
  updateDiscordEventSettings(userId: string, enabledEvents: string[]): Promise<DiscordSettings | undefined>;

  // Discord Bot methods (new)
  getLinkCode(code: string): Promise<LinkCode | undefined>;
  createLinkCode(linkCode: InsertLinkCode): Promise<LinkCode>;
  consumeLinkCode(code: string): Promise<void>;
  getGuildLink(guildId: string): Promise<GuildLink | undefined>;
  createGuildLink(guildLink: InsertGuildLink): Promise<GuildLink>;
  deactivateGuildLink(guildId: string): Promise<void>;
  getAllActiveGuildLinks(): Promise<GuildLink[]>;
  getGuildSettings(guildId: string): Promise<GuildSettings | undefined>;
  upsertGuildSettings(settings: InsertGuildSettings): Promise<GuildSettings>;

  // Billing and API Key methods
  saveUserApiKey(keyData: { userId: string; provider: string; apiKey: string; isActive?: boolean }): Promise<void>;
  getUserApiKeys(userId: string): Promise<any[]>;
  deleteUserApiKey(userId: string, provider: string): Promise<void>;
  getUsageTracking(userId: string, period: string): Promise<any>;
  updateUsageTracking(userId: string, updates: any): Promise<void>;

  // Streaming session management
  getCurrentStreamer(guildId: string): Promise<string | null>;
  setCurrentStreamer(guildId: string, userId: string): Promise<void>;
  clearCurrentStreamer(guildId: string): Promise<void>;

  // Context memory methods
  createContextMemory(context: InsertContextMemory): Promise<ContextMemory>;
  getRecentContext(userId: string, guildId?: string, limit?: number): Promise<ContextMemory[]>;
  getContextByType(userId: string, eventType: string, guildId?: string, limit?: number): Promise<ContextMemory[]>;
  updateContextResponse(contextId: string, banterResponse: string): Promise<void>;
  cleanExpiredContext(): Promise<number>;

  // Marketplace methods
  createMarketplaceVoice(voice: InsertMarketplaceVoice): Promise<MarketplaceVoice>;
  createMarketplacePersonality(personality: InsertMarketplacePersonality): Promise<MarketplacePersonality>;
  getMarketplaceVoices(filters?: { category?: string; search?: string; sortBy?: string; limit?: number }): Promise<MarketplaceVoice[]>;
  getMarketplacePersonalities(filters?: { category?: string; search?: string; sortBy?: string; limit?: number }): Promise<MarketplacePersonality[]>;
  getMarketplaceVoice(id: string): Promise<MarketplaceVoice | undefined>;
  getMarketplacePersonality(id: string): Promise<MarketplacePersonality | undefined>;
  updateMarketplaceItem(itemType: 'voice' | 'personality', id: string, updates: any): Promise<void>;
  
  // User interactions
  downloadMarketplaceItem(userId: string, itemType: 'voice' | 'personality', itemId: string): Promise<UserDownload>;
  hasUserDownloaded(userId: string, itemType: 'voice' | 'personality', itemId: string): Promise<boolean>;
  rateMarketplaceItem(userId: string, itemType: 'voice' | 'personality', itemId: string, rating: 1 | -1): Promise<void>;
  getUserRating(userId: string, itemType: 'voice' | 'personality', itemId: string): Promise<number | null>;
  
  // Moderation
  moderateMarketplaceItem(itemType: 'voice' | 'personality', itemId: string, status: 'approved' | 'rejected', moderatorId: string, notes?: string): Promise<void>;
  getPendingModerationItems(): Promise<{ voices: MarketplaceVoice[]; personalities: MarketplacePersonality[] }>;
  
  // Reporting
  reportContent(report: InsertContentReport): Promise<ContentReport>;
  getContentReports(status?: string): Promise<ContentReport[]>;
  reviewReport(reportId: string, reviewerId: string, status: 'resolved' | 'dismissed', notes?: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private banterItems: Map<string, BanterItem> = new Map();
  private userSettings: Map<string, UserSettings> = new Map();
  private dailyStats: Map<string, DailyStats> = new Map();
  private twitchSettings: Map<string, TwitchSettings> = new Map();
  private discordSettings: Map<string, DiscordSettings> = new Map();
  private linkCodes: Map<string, LinkCode> = new Map();
  private guildLinks: Map<string, GuildLink> = new Map();
  private guildSettings: Map<string, GuildSettings> = new Map();
  private contextMemory: Map<string, ContextMemory> = new Map();

  constructor() {
    // Create a demo user for Replit Auth compatibility
    const demoUser: User = {
      id: "demo-user",
      email: "demo@example.com",
      firstName: "Demo",
      lastName: "Streamer",
      profileImageUrl: null,
      isPro: true, // Give demo user pro access
      hasCompletedOnboarding: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(demoUser.id, demoUser);

    // Create default settings for demo user
    const demoSettings: UserSettings = {
      id: "demo-settings",
      userId: "demo-user",
      voiceProvider: "openai",
      voiceId: null,
      autoPlay: true,
      volume: 75,
      enabledEvents: ['chat'],
      overlayPosition: "bottom-center",
      overlayDuration: 5,
      overlayAnimation: "fade",
              banterPersonality: "context",
      customPersonalityPrompt: null,
      updatedAt: new Date(),
    };
    this.userSettings.set("demo-user", demoSettings);

    // Create demo stats
    const today = new Date().toISOString().split('T')[0];
    const demoStats: DailyStats = {
      id: "demo-stats",
      userId: "demo-user",
      date: today,
      bantersGenerated: 47,
      bantersPlayed: 35,
      chatResponses: 23,
      audioGenerated: 720, // 12 minutes in seconds
      viewerEngagement: 89,
      peakHour: 20, // 8 PM peak activity
    };
    this.dailyStats.set(`demo-user-${today}`, demoStats);
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existingUser = this.users.get(userData.id!);
    
    if (existingUser) {
      // Update existing user
      const updatedUser: User = {
        ...existingUser,
        ...userData,
        updatedAt: new Date(),
      };
      this.users.set(userData.id!, updatedUser);
      return updatedUser;
    } else {
      // Create new user
      const newUser: User = {
        id: userData.id || randomUUID(),
        email: userData.email || null,
        passwordHash: userData.passwordHash || null,
        firstName: userData.firstName || null,
        lastName: userData.lastName || null,
        profileImageUrl: userData.profileImageUrl || null,
        isPro: userData.isPro ?? false,
        hasCompletedOnboarding: userData.hasCompletedOnboarding ?? false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.users.set(newUser.id, newUser);
      return newUser;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    // Legacy method - no longer used with Replit Auth
    return Array.from(this.users.values()).find(user => user.email === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id,
      email: insertUser.email || null,
      firstName: insertUser.firstName || null,
      lastName: insertUser.lastName || null,
      profileImageUrl: insertUser.profileImageUrl || null,
      isPro: insertUser.isPro ?? false,
      hasCompletedOnboarding: insertUser.hasCompletedOnboarding ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async completeOnboarding(userId: string): Promise<User> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }
    
    const updatedUser: User = {
      ...user,
      hasCompletedOnboarding: true,
      updatedAt: new Date(),
    };
    
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  // Banter methods
  async getBanterItem(id: string): Promise<BanterItem | undefined> {
    return this.banterItems.get(id);
  }

  async searchBanters(userId: string, query?: string, eventType?: string, limit = 20): Promise<BanterItem[]> {
    let banters = Array.from(this.banterItems.values())
      .filter(banter => banter.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (query) {
      const searchTerm = query.toLowerCase();
      banters = banters.filter(banter => 
        banter.banterText.toLowerCase().includes(searchTerm) ||
        banter.originalMessage?.toLowerCase().includes(searchTerm)
      );
    }

    if (eventType && eventType !== 'all') {
      banters = banters.filter(banter => banter.eventType === eventType);
    }

    return banters.slice(0, limit);
  }

  async getBantersByUser(userId: string, limit = 10): Promise<BanterItem[]> {
    return Array.from(this.banterItems.values())
      .filter(banter => banter.userId === userId)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
      .slice(0, limit);
  }

  async createBanterItem(insertBanter: InsertBanterItem): Promise<BanterItem> {
    const id = randomUUID();
    const banter: BanterItem = {
      ...insertBanter,
      id,
      userId: insertBanter.userId ?? null,
      originalMessage: insertBanter.originalMessage ?? null,
      eventData: insertBanter.eventData ?? null,
      audioUrl: insertBanter.audioUrl ?? null,
      isPlayed: insertBanter.isPlayed ?? false,
      createdAt: new Date(),
    };
    this.banterItems.set(id, banter);
    console.log(`Created banter ${id} for user ${banter.userId}. Total banters in storage: ${this.banterItems.size}`);
    return banter;
  }

  async updateBanterItem(id: string, updates: Partial<BanterItem>): Promise<BanterItem | undefined> {
    const existing = this.banterItems.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.banterItems.set(id, updated);
    return updated;
  }

  async deleteBanterItem(id: string): Promise<boolean> {
    return this.banterItems.delete(id);
  }

  // Settings methods
  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    return this.userSettings.get(userId);
  }

  async createUserSettings(insertSettings: InsertUserSettings): Promise<UserSettings> {
    const id = randomUUID();
    const settings: UserSettings = {
      ...insertSettings,
      id,
      userId: insertSettings.userId ?? null,
      voiceProvider: insertSettings.voiceProvider ?? "openai",
      voiceId: insertSettings.voiceId ?? null,
      autoPlay: insertSettings.autoPlay ?? true,
      volume: insertSettings.volume ?? 75,
      enabledEvents: insertSettings.enabledEvents ?? ['chat'],
      overlayPosition: insertSettings.overlayPosition ?? "bottom-center",
      overlayDuration: insertSettings.overlayDuration ?? 5,
      overlayAnimation: insertSettings.overlayAnimation ?? "fade",
      updatedAt: new Date(),
    };
    this.userSettings.set(insertSettings.userId!, settings);
    return settings;
  }

  async updateUserSettings(userId: string, updates: Partial<UserSettings>): Promise<UserSettings | undefined> {
    const existing = this.userSettings.get(userId);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.userSettings.set(userId, updated);
    return updated;
  }

  // Stats methods
  async getDailyStats(userId: string, date: string): Promise<DailyStats | undefined> {
    return this.dailyStats.get(`${userId}-${date}`);
  }

  async createDailyStats(insertStats: InsertDailyStats): Promise<DailyStats> {
    const id = randomUUID();
    const stats: DailyStats = { 
      ...insertStats, 
      id,
      userId: insertStats.userId ?? null,
      bantersGenerated: insertStats.bantersGenerated ?? 0,
      chatResponses: insertStats.chatResponses ?? 0,
      audioGenerated: insertStats.audioGenerated ?? 0,
      viewerEngagement: insertStats.viewerEngagement ?? 0
    };
    this.dailyStats.set(`${insertStats.userId}-${insertStats.date}`, stats);
    return stats;
  }

  async updateDailyStats(userId: string, date: string, updates: Partial<DailyStats>): Promise<DailyStats | undefined> {
    const key = `${userId}-${date}`;
    const existing = this.dailyStats.get(key);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.dailyStats.set(key, updated);
    return updated;
  }

  // Twitch methods
  async getTwitchSettings(userId: string): Promise<TwitchSettings | undefined> {
    return this.twitchSettings.get(userId) || undefined;
  }

  async upsertTwitchSettings(settings: InsertTwitchSettings): Promise<TwitchSettings> {
    const id = randomUUID();
    const twitchSetting: TwitchSettings = {
      id,
      userId: settings.userId,
      accessToken: settings.accessToken || null,
      refreshToken: settings.refreshToken || null,
      twitchUsername: settings.twitchUsername || null,
      twitchUserId: settings.twitchUserId || null,
      isConnected: settings.isConnected || false,
      enabledEvents: settings.enabledEvents || ['chat', 'subscribe', 'cheer', 'raid', 'follow'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.twitchSettings.set(settings.userId, twitchSetting);
    return twitchSetting;
  }

  async updateTwitchEventSettings(userId: string, enabledEvents: string[]): Promise<TwitchSettings | undefined> {
    const existing = this.twitchSettings.get(userId);
    if (!existing) return undefined;

    const updated: TwitchSettings = {
      ...existing,
      enabledEvents,
      updatedAt: new Date(),
    };
    this.twitchSettings.set(userId, updated);
    return updated;
  }

  async checkAndIncrementDailyUsage(userId: string): Promise<{ allowed: boolean; current: number; limit: number; isPro: boolean }> {
    const user = await this.getUser(userId);
    const subscriptionTier = user?.subscriptionTier || 'free';
    const isPro = subscriptionTier === 'pro' || subscriptionTier === 'byok' || subscriptionTier === 'enterprise';
    const limit = isPro ? 999999 : 50; // Unlimited for Pro, 50 for free tier
    
    const today = new Date().toISOString().split('T')[0];
    const statsKey = `${userId}-${today}`;
    let stats = this.dailyStats.get(statsKey);
    
    if (!stats) {
      // Create new daily stats
      stats = {
        id: randomUUID(),
        userId,
        date: today,
        bantersGenerated: 0,
        bantersPlayed: 0,
        chatResponses: 0,
        audioGenerated: 0,
        viewerEngagement: 0,
        peakHour: null,
      };
      this.dailyStats.set(statsKey, stats);
    }
    
    const current = stats.bantersGenerated || 0;
    
    if (current >= limit && !isPro) {
      return { allowed: false, current, limit, isPro };
    }
    
    // Increment the usage
    stats.bantersGenerated = current + 1;
    this.dailyStats.set(statsKey, stats);
    
    return { allowed: true, current: current + 1, limit, isPro };
  }

  // Discord methods
  async getDiscordSettings(userId: string): Promise<DiscordSettings | undefined> {
    return this.discordSettings.get(userId) || undefined;
  }

  async upsertDiscordSettings(settings: InsertDiscordSettings): Promise<DiscordSettings> {
    const id = randomUUID();
    const discordSetting: DiscordSettings = {
      id,
      userId: settings.userId,
      discordUserId: settings.discordUserId || null,
      discordUsername: settings.discordUsername || null,
      discordTag: settings.discordTag || null,
      accessToken: settings.accessToken || null,
      refreshToken: settings.refreshToken || null,
      isConnected: settings.isConnected || false,
      enabledEvents: settings.enabledEvents || ['discord_message', 'discord_member_join', 'discord_reaction'],
      connectedGuilds: settings.connectedGuilds || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.discordSettings.set(settings.userId, discordSetting);
    return discordSetting;
  }

  async updateDiscordEventSettings(userId: string, enabledEvents: string[]): Promise<DiscordSettings | undefined> {
    const existing = this.discordSettings.get(userId);
    if (!existing) return undefined;

    const updated: DiscordSettings = {
      ...existing,
      enabledEvents,
      updatedAt: new Date(),
    };
    this.discordSettings.set(userId, updated);
    return updated;
  }

  // Discord Bot methods
  async getLinkCode(code: string): Promise<LinkCode | undefined> {
    return this.linkCodes.get(code);
  }

  async createLinkCode(insertLinkCode: InsertLinkCode): Promise<LinkCode> {
    const id = randomUUID();
    const linkCode: LinkCode = {
      ...insertLinkCode,
      id,
      createdAt: new Date(),
      consumedAt: null,
    };
    this.linkCodes.set(insertLinkCode.code, linkCode);
    return linkCode;
  }

  async consumeLinkCode(code: string): Promise<void> {
    const linkCode = this.linkCodes.get(code);
    if (linkCode) {
      linkCode.consumedAt = new Date();
      this.linkCodes.set(code, linkCode);
    }
  }

  async getGuildLink(guildId: string): Promise<GuildLink | undefined> {
    return this.guildLinks.get(guildId);
  }

  async createGuildLink(insertGuildLink: InsertGuildLink): Promise<GuildLink> {
    const id = randomUUID();
    const guildLink: GuildLink = {
      ...insertGuildLink,
      id,
      createdAt: new Date(),
    };
    this.guildLinks.set(insertGuildLink.guildId, guildLink);
    return guildLink;
  }

  async deactivateGuildLink(guildId: string): Promise<void> {
    const guildLink = this.guildLinks.get(guildId);
    if (guildLink) {
      guildLink.active = false;
      this.guildLinks.set(guildId, guildLink);
    }
  }

  async getAllActiveGuildLinks(): Promise<GuildLink[]> {
    return Array.from(this.guildLinks.values()).filter(link => link.active);
  }

  async getGuildSettings(guildId: string): Promise<GuildSettings | undefined> {
    return this.guildSettings.get(guildId);
  }

  async upsertGuildSettings(settings: InsertGuildSettings): Promise<GuildSettings> {
    const existing = this.guildSettings.get(settings.guildId);
    const guildSettings: GuildSettings = {
      ...settings,
      currentStreamer: settings.currentStreamer || null,
      updatedAt: new Date(),
    };
    this.guildSettings.set(settings.guildId, guildSettings);
    return guildSettings;
  }

  // Billing and API Key methods
  async saveUserApiKey(keyData: { userId: string; provider: string; apiKey: string; isActive?: boolean }): Promise<void> {
    // In-memory storage, no persistent DB
    // For a real DB, you'd insert or update in a table
    console.log(`Saving API key for user ${keyData.userId} with provider ${keyData.provider}`);
  }

  async getUserApiKeys(userId: string): Promise<any[]> {
    // In-memory storage, no persistent DB
    // For a real DB, you'd select from a table
    console.log(`Getting API keys for user ${userId}`);
    return []; // Placeholder
  }

  async deleteUserApiKey(userId: string, provider: string): Promise<void> {
    // In-memory storage, no persistent DB
    // For a real DB, you'd delete from a table
    console.log(`Deleting API key for user ${userId} with provider ${provider}`);
  }

  async getUsageTracking(userId: string, period: string): Promise<any> {
    // In-memory storage, no persistent DB
    // For a real DB, you'd select from a table
    console.log(`Getting usage tracking for user ${userId} for period ${period}`);
    return {}; // Placeholder
  }

  async updateUsageTracking(userId: string, updates: any): Promise<void> {
    // In-memory storage, no persistent DB
    // For a real DB, you'd update in a table
    console.log(`Updating usage tracking for user ${userId} with updates:`, updates);
  }

  // Streaming session management
  async getCurrentStreamer(guildId: string): Promise<string | null> {
    const settings = this.guildSettings.get(guildId);
    return settings?.currentStreamer || null;
  }

  async setCurrentStreamer(guildId: string, userId: string): Promise<void> {
    const settings = this.guildSettings.get(guildId);
    if (settings) {
      settings.currentStreamer = userId;
    }
  }

  async clearCurrentStreamer(guildId: string): Promise<void> {
    const settings = this.guildSettings.get(guildId);
    if (settings) {
      settings.currentStreamer = null;
    }
  }

  // Context memory methods
  async createContextMemory(context: InsertContextMemory): Promise<ContextMemory> {
    const id = randomUUID();
    const contextMemory: ContextMemory = {
      ...context,
      id,
      createdAt: new Date(),
    };
    this.contextMemory.set(id, contextMemory);
    return contextMemory;
  }

  async getRecentContext(userId: string, guildId?: string, limit: number = 10): Promise<ContextMemory[]> {
    const contexts = Array.from(this.contextMemory.values())
      .filter(ctx => {
        if (ctx.userId !== userId) return false;
        if (guildId && ctx.guildId !== guildId) return false;
        if (ctx.expiresAt < new Date()) return false;
        return true;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
    return contexts;
  }

  async getContextByType(userId: string, eventType: string, guildId?: string, limit: number = 5): Promise<ContextMemory[]> {
    const contexts = Array.from(this.contextMemory.values())
      .filter(ctx => {
        if (ctx.userId !== userId) return false;
        if (ctx.eventType !== eventType) return false;
        if (guildId && ctx.guildId !== guildId) return false;
        if (ctx.expiresAt < new Date()) return false;
        return true;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
    return contexts;
  }

  async updateContextResponse(contextId: string, banterResponse: string): Promise<void> {
    const context = this.contextMemory.get(contextId);
    if (context) {
      context.banterResponse = banterResponse;
    }
  }

  async cleanExpiredContext(): Promise<number> {
    const now = new Date();
    let cleanedCount = 0;
    
    for (const [id, context] of this.contextMemory.entries()) {
      if (context.expiresAt < now) {
        this.contextMemory.delete(id);
        cleanedCount++;
      }
    }
    
    return cleanedCount;
  }
}

export class DatabaseStorage implements IStorage {
  // User methods (required for Local Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async completeOnboarding(userId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ hasCompletedOnboarding: true })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Legacy user methods for backward compatibility
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Banter methods
  async getBanterItem(id: string): Promise<BanterItem | undefined> {
    const [banter] = await db.select().from(banterItems).where(eq(banterItems.id, id));
    return banter;
  }

  async getBantersByUser(userId: string, limit: number = 50): Promise<BanterItem[]> {
    return await db.select()
      .from(banterItems)
      .where(eq(banterItems.userId, userId))
      .orderBy(desc(banterItems.createdAt))
      .limit(limit);
  }

  async searchBanters(userId: string, query: string, eventType: string, limit: number = 50): Promise<BanterItem[]> {
    let queryBuilder = db.select().from(banterItems);
    
    if (eventType && eventType !== 'all') {
      queryBuilder = queryBuilder.where(
        and(
          eq(banterItems.userId, userId),
          eq(banterItems.eventType, eventType)
        )
      );
    } else {
      queryBuilder = queryBuilder.where(eq(banterItems.userId, userId));
    }

    return await queryBuilder
      .orderBy(desc(banterItems.createdAt))
      .limit(limit);
  }

  async createBanterItem(insertBanter: InsertBanterItem): Promise<BanterItem> {
    const [banter] = await db
      .insert(banterItems)
      .values(insertBanter)
      .returning();
    return banter;
  }

  async updateBanterItem(id: string, updates: Partial<BanterItem>): Promise<BanterItem | undefined> {
    const [banter] = await db
      .update(banterItems)
      .set(updates)
      .where(eq(banterItems.id, id))
      .returning();
    return banter;
  }

  async deleteBanterItem(id: string): Promise<boolean> {
    const result = await db.delete(banterItems).where(eq(banterItems.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Settings methods
  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    return settings;
  }

  async createUserSettings(insertSettings: InsertUserSettings): Promise<UserSettings> {
    const [settings] = await db
      .insert(userSettings)
      .values(insertSettings)
      .returning();
    return settings;
  }

  async updateUserSettings(userId: string, updates: Partial<UserSettings>): Promise<UserSettings | undefined> {
    const [settings] = await db
      .update(userSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(userSettings.userId, userId))
      .returning();
    return settings;
  }

  // Stats methods
  async getDailyStats(userId: string, date: string): Promise<DailyStats | undefined> {
    const [stats] = await db.select().from(dailyStats).where(
      and(eq(dailyStats.userId, userId), eq(dailyStats.date, date))
    );
    return stats;
  }

  async createDailyStats(insertStats: InsertDailyStats): Promise<DailyStats> {
    const [stats] = await db
      .insert(dailyStats)
      .values(insertStats)
      .returning();
    return stats;
  }

  async updateDailyStats(userId: string, date: string, updates: Partial<DailyStats>): Promise<DailyStats | undefined> {
    const [stats] = await db
      .update(dailyStats)
      .set(updates)
      .where(and(eq(dailyStats.userId, userId), eq(dailyStats.date, date)))
      .returning();
    return stats;
  }

  async checkAndIncrementDailyUsage(userId: string): Promise<{ allowed: boolean; current: number; limit: number; isPro: boolean }> {
    const user = await this.getUser(userId);
    const subscriptionTier = user?.subscriptionTier || 'free';
    const isPro = subscriptionTier === 'pro' || subscriptionTier === 'byok' || subscriptionTier === 'enterprise';
    const limit = isPro ? 999999 : 50;
    
    const today = new Date().toISOString().split('T')[0];
    
    // Get or create daily stats
    let stats = await this.getDailyStats(userId, today);
    if (!stats) {
      stats = await this.createDailyStats({ userId, date: today, bantersGenerated: 0 });
    }
    
    const current = stats.bantersGenerated || 0;
    
    if (current >= limit && !isPro) {
      return { allowed: false, current, limit, isPro };
    }
    
    // Increment usage
    await this.updateDailyStats(userId, today, { bantersGenerated: current + 1 });
    
    return { allowed: true, current: current + 1, limit, isPro };
  }

  // Twitch methods
  async getTwitchSettings(userId: string): Promise<TwitchSettings | undefined> {
    const [settings] = await db.select().from(twitchSettings).where(eq(twitchSettings.userId, userId));
    return settings;
  }

  async upsertTwitchSettings(settings: InsertTwitchSettings): Promise<TwitchSettings> {
    const [result] = await db
      .insert(twitchSettings)
      .values(settings)
      .onConflictDoUpdate({
        target: twitchSettings.userId,
        set: {
          ...settings,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  async updateTwitchEventSettings(userId: string, enabledEvents: string[]): Promise<TwitchSettings | undefined> {
    const [settings] = await db
      .update(twitchSettings)
      .set({ enabledEvents, updatedAt: new Date() })
      .where(eq(twitchSettings.userId, userId))
      .returning();
    return settings;
  }

  // Discord methods
  async getDiscordSettings(userId: string): Promise<DiscordSettings | undefined> {
    const [settings] = await db.select().from(discordSettings).where(eq(discordSettings.userId, userId));
    return settings;
  }

  async upsertDiscordSettings(settings: InsertDiscordSettings): Promise<DiscordSettings> {
    const [result] = await db
      .insert(discordSettings)
      .values(settings)
      .onConflictDoUpdate({
        target: discordSettings.userId,
        set: {
          ...settings,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  async updateDiscordEventSettings(userId: string, enabledEvents: string[]): Promise<DiscordSettings | undefined> {
    const [settings] = await db
      .update(discordSettings)
      .set({ enabledEvents, updatedAt: new Date() })
      .where(eq(discordSettings.userId, userId))
      .returning();
    return settings;
  }

  // Discord Bot methods
  async getLinkCode(code: string): Promise<LinkCode | undefined> {
    const [linkCode] = await db.select().from(linkCodes).where(eq(linkCodes.code, code));
    return linkCode;
  }

  async createLinkCode(insertLinkCode: InsertLinkCode): Promise<LinkCode> {
    const [linkCode] = await db.insert(linkCodes).values(insertLinkCode).returning();
    return linkCode;
  }

  async consumeLinkCode(code: string): Promise<void> {
    await db
      .update(linkCodes)
      .set({ consumedAt: new Date() })
      .where(eq(linkCodes.code, code));
  }

  async getGuildLink(guildId: string): Promise<GuildLink | undefined> {
    const [guildLink] = await db.select().from(guildLinks).where(eq(guildLinks.guildId, guildId));
    return guildLink;
  }

  async createGuildLink(insertGuildLink: InsertGuildLink): Promise<GuildLink> {
    const [guildLink] = await db.insert(guildLinks).values(insertGuildLink).returning();
    return guildLink;
  }

  async deactivateGuildLink(guildId: string): Promise<void> {
    await db
      .update(guildLinks)
      .set({ active: false })
      .where(eq(guildLinks.guildId, guildId));
  }

  async getAllActiveGuildLinks(): Promise<GuildLink[]> {
    const guildLinks = await db.select().from(guildLinks).where(eq(guildLinks.active, true));
    return guildLinks;
  }

  async getGuildSettings(guildId: string): Promise<GuildSettings | undefined> {
    const [settings] = await db.select().from(guildSettings).where(eq(guildSettings.guildId, guildId));
    return settings;
  }

  async upsertGuildSettings(settings: InsertGuildSettings): Promise<GuildSettings> {
    const [result] = await db
      .insert(guildSettings)
      .values(settings)
      .onConflictDoUpdate({
        target: guildSettings.guildId,
        set: {
          ...settings,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  // Billing and API Key methods
  async saveUserApiKey(keyData: { userId: string; provider: string; apiKey: string; isActive?: boolean }): Promise<void> {
    // In-memory storage, no persistent DB
    // For a real DB, you'd insert or update in a table
    console.log(`Saving API key for user ${keyData.userId} with provider ${keyData.provider}`);
  }

  async getUserApiKeys(userId: string): Promise<any[]> {
    // In-memory storage, no persistent DB
    // For a real DB, you'd select from a table
    console.log(`Getting API keys for user ${userId}`);
    return []; // Placeholder
  }

  async deleteUserApiKey(userId: string, provider: string): Promise<void> {
    // In-memory storage, no persistent DB
    // For a real DB, you'd delete from a table
    console.log(`Deleting API key for user ${userId} with provider ${provider}`);
  }

  async getUsageTracking(userId: string, period: string): Promise<any> {
    // In-memory storage, no persistent DB
    // For a real DB, you'd select from a table
    console.log(`Getting usage tracking for user ${userId} for period ${period}`);
    return {}; // Placeholder
  }

  async updateUsageTracking(userId: string, updates: any): Promise<void> {
    // In-memory storage, no persistent DB
    // For a real DB, you'd update in a table
    console.log(`Updating usage tracking for user ${userId} with updates:`, updates);
  }

  // Streaming session management
  async getCurrentStreamer(guildId: string): Promise<string | null> {
    const settings = await this.getGuildSettings(guildId);
    return settings?.currentStreamer || null;
  }

  async setCurrentStreamer(guildId: string, userId: string): Promise<void> {
    await db
      .update(guildSettings)
      .set({ currentStreamer: userId })
      .where(eq(guildSettings.guildId, guildId));
  }

  async clearCurrentStreamer(guildId: string): Promise<void> {
    await db
      .update(guildSettings)
      .set({ currentStreamer: null })
      .where(eq(guildSettings.guildId, guildId));
  }

  // Context memory methods
  async createContextMemory(context: InsertContextMemory): Promise<ContextMemory> {
    const [result] = await db.insert(contextMemory).values(context).returning();
    return result;
  }

  async getRecentContext(userId: string, guildId?: string, limit: number = 10): Promise<ContextMemory[]> {
    let query = db
      .select()
      .from(contextMemory)
      .where(
        and(
          eq(contextMemory.userId, userId),
          sql`${contextMemory.expiresAt} > NOW()`
        )
      )
      .orderBy(desc(contextMemory.createdAt))
      .limit(limit);

    if (guildId) {
      query = db
        .select()
        .from(contextMemory)
        .where(
          and(
            eq(contextMemory.userId, userId),
            eq(contextMemory.guildId, guildId),
            sql`${contextMemory.expiresAt} > NOW()`
          )
        )
        .orderBy(desc(contextMemory.createdAt))
        .limit(limit);
    }

    return await query;
  }

  async getContextByType(userId: string, eventType: string, guildId?: string, limit: number = 5): Promise<ContextMemory[]> {
    let query = db
      .select()
      .from(contextMemory)
      .where(
        and(
          eq(contextMemory.userId, userId),
          eq(contextMemory.eventType, eventType),
          sql`${contextMemory.expiresAt} > NOW()`
        )
      )
      .orderBy(desc(contextMemory.createdAt))
      .limit(limit);

    if (guildId) {
      query = db
        .select()
        .from(contextMemory)
        .where(
          and(
            eq(contextMemory.userId, userId),
            eq(contextMemory.eventType, eventType),
            eq(contextMemory.guildId, guildId),
            sql`${contextMemory.expiresAt} > NOW()`
          )
        )
        .orderBy(desc(contextMemory.createdAt))
        .limit(limit);
    }

    return await query;
  }

  async updateContextResponse(contextId: string, banterResponse: string): Promise<void> {
    await db
      .update(contextMemory)
      .set({ banterResponse })
      .where(eq(contextMemory.id, contextId));
  }

  async cleanExpiredContext(): Promise<number> {
    const result = await db
      .delete(contextMemory)
      .where(sql`${contextMemory.expiresAt} < NOW()`);
    return result.rowCount || 0;
  }
}

export const storage = new DatabaseStorage();
