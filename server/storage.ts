import { type User, type InsertUser, type UpsertUser, type BanterItem, type InsertBanterItem, type UserSettings, type InsertUserSettings, type DailyStats, type InsertDailyStats, type TwitchSettings, type InsertTwitchSettings, type DiscordSettings, type InsertDiscordSettings, type LinkCode, type InsertLinkCode, type GuildLink, type InsertGuildLink, type GuildSettings, type InsertGuildSettings, type ContextMemory, type InsertContextMemory, type PersonalityMarketplace, type InsertPersonalityMarketplace, type PersonalityVote, type InsertPersonalityVote, type PersonalityDownload, type InsertPersonalityDownload, type CustomVoice, type InsertCustomVoice, type VoiceMarketplace, type InsertVoiceMarketplace, type VoiceVote, type InsertVoiceVote, type VoiceDownload, type InsertVoiceDownload, type EventType, type EventData, users, banterItems, userSettings, dailyStats, twitchSettings, discordSettings, linkCodes, guildLinks, guildSettings, contextMemory, personalityMarketplace, personalityVotes, personalityDownloads, customVoices, voiceMarketplace, voiceVotes, voiceDownloads } from "../shared/schema.js";
import { randomUUID } from "crypto";
import { db } from "./db,js";
import { eq, and, desc, sql } from "drizzle-orm";

export interface IStorage {
  // User methods (required for Replit Auth)
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
  reactivateGuildLink(guildId: string, workspaceId: string, linkedByUserId: string): Promise<void>;
  getGuildSettings(guildId: string): Promise<GuildSettings | undefined>;
  upsertGuildSettings(settings: InsertGuildSettings): Promise<GuildSettings>;
  
  // Streaming session management
  getCurrentStreamer(guildId: string): Promise<string | null>;
  setCurrentStreamer(guildId: string, userId: string): Promise<void>;
  clearCurrentStreamer(guildId: string): Promise<void>;
  
  // Context memory methods
  createContextMemory(memory: InsertContextMemory): Promise<ContextMemory>;
  getRecentContext(userId: string, guildId?: string, limit?: number): Promise<ContextMemory[]>;
  getContextByEventType(userId: string, eventType: string, guildId?: string, limit?: number): Promise<ContextMemory[]>;
  cleanExpiredContext(): Promise<number>; // Returns number of cleaned records
  getContextSummary(userId: string, guildId?: string): Promise<string>;

  // Marketplace methods
  getMarketplacePersonalities(category?: string, sortBy?: 'popular' | 'recent' | 'trending', limit?: number): Promise<PersonalityMarketplace[]>;
  getPersonalityById(id: string): Promise<PersonalityMarketplace | undefined>;
  createMarketplacePersonality(personality: InsertPersonalityMarketplace): Promise<PersonalityMarketplace>;
  updateMarketplacePersonality(id: string, updates: Partial<PersonalityMarketplace>): Promise<PersonalityMarketplace | undefined>;
  deleteMarketplacePersonality(id: string): Promise<boolean>;
  voteOnPersonality(vote: InsertPersonalityVote): Promise<PersonalityVote>;
  getUserVote(personalityId: string, userId: string): Promise<PersonalityVote | undefined>;
  downloadPersonality(download: InsertPersonalityDownload): Promise<PersonalityDownload>;
  getUserPersonalities(userId: string): Promise<PersonalityMarketplace[]>;
  searchPersonalities(query: string, category?: string): Promise<PersonalityMarketplace[]>;

  // Custom voice methods
  saveCustomVoice(voice: InsertCustomVoice): Promise<CustomVoice>;
  getCustomVoices(userId: string): Promise<CustomVoice[]>;
  deleteCustomVoice(voiceId: string, userId: string): Promise<boolean>;

  // Voice marketplace methods
  createVoiceMarketplace(voice: InsertVoiceMarketplace): Promise<VoiceMarketplace>;
  getVoiceMarketplace(category?: string, sortBy?: 'popular' | 'recent' | 'trending', limit?: number): Promise<VoiceMarketplace[]>;
  getVoiceById(id: string): Promise<VoiceMarketplace | undefined>;
  voteOnVoice(vote: InsertVoiceVote): Promise<VoiceVote>;
  downloadVoice(download: InsertVoiceDownload): Promise<VoiceDownload>;
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
  private marketplacePersonalities: Map<string, PersonalityMarketplace> = new Map();
  private personalityVotes: Map<string, PersonalityVote> = new Map();
  private personalityDownloads: Map<string, PersonalityDownload> = new Map();
  private customVoices: Map<string, CustomVoice> = new Map();
  private voiceMarketplace: Map<string, VoiceMarketplace> = new Map();
  private voiceVotes: Map<string, VoiceVote> = new Map();
  private voiceDownloads: Map<string, VoiceDownload> = new Map();
  private currentStreamers: Map<string, string> = new Map(); // guildId -> userId

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
      banterPersonality: "witty",
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
    return Array.from(this.users.values()).find(u => u.email === email);
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
    const isPro = user?.isPro ?? false;
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

  async reactivateGuildLink(guildId: string, workspaceId: string, linkedByUserId: string): Promise<void> {
    const guildLink = this.guildLinks.get(guildId);
    if (guildLink) {
      guildLink.active = true;
      guildLink.workspaceId = workspaceId;
      guildLink.linkedByUserId = linkedByUserId;
      this.guildLinks.set(guildId, guildLink);
    }
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
  async createContextMemory(memory: InsertContextMemory): Promise<ContextMemory> {
    const id = randomUUID();
    const contextMemory: ContextMemory = {
      ...memory,
      id,
      createdAt: new Date(),
    };
    this.contextMemory.set(id, contextMemory);
    return contextMemory;
  }

  async getRecentContext(userId: string, guildId?: string, limit: number = 10): Promise<ContextMemory[]> {
    const now = new Date();
    return Array.from(this.contextMemory.values())
      .filter(ctx => 
        ctx.userId === userId &&
        ctx.expiresAt > now &&
        (!guildId || ctx.guildId === guildId)
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async getContextByEventType(userId: string, eventType: string, guildId?: string, limit: number = 5): Promise<ContextMemory[]> {
    const now = new Date();
    return Array.from(this.contextMemory.values())
      .filter(ctx => 
        ctx.userId === userId &&
        ctx.eventType === eventType &&
        ctx.expiresAt > now &&
        (!guildId || ctx.guildId === guildId)
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async cleanExpiredContext(): Promise<number> {
    const now = new Date();
    const expired = Array.from(this.contextMemory.entries())
      .filter(([_, ctx]) => ctx.expiresAt <= now);
    
    expired.forEach(([id]) => this.contextMemory.delete(id));
    return expired.length;
  }

  async getContextSummary(userId: string, guildId?: string): Promise<string> {
    const recentContext = await this.getRecentContext(userId, guildId, 5);
    
    if (recentContext.length === 0) {
      return "No recent activity to remember.";
    }

    const summaries = recentContext
      .map(ctx => ctx.contextSummary)
      .filter(summary => summary)
      .join('. ');

    return summaries || "Recent stream activity occurred.";
  }

  // Marketplace methods
  async getMarketplacePersonalities(category?: string, sortBy: 'popular' | 'recent' | 'trending' = 'popular', limit: number = 20): Promise<PersonalityMarketplace[]> {
    const personalities = Array.from(this.marketplacePersonalities.values())
      .filter(p => p.isActive && (!category || p.category === category));

    switch (sortBy) {
      case 'popular':
        return personalities.sort((a, b) => (b.downloads + b.upvotes) - (a.downloads + a.upvotes)).slice(0, limit);
      case 'recent':
        return personalities.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
      case 'trending':
        return personalities.sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes)).slice(0, limit);
      default:
        return personalities.slice(0, limit);
    }
  }

  async getPersonalityById(id: string): Promise<PersonalityMarketplace | undefined> {
    return this.marketplacePersonalities.get(id);
  }

  async createMarketplacePersonality(personality: InsertPersonalityMarketplace): Promise<PersonalityMarketplace> {
    const id = randomUUID();
    const newPersonality: PersonalityMarketplace = {
      ...personality,
      id,
      downloads: 0,
      upvotes: 0,
      downvotes: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.marketplacePersonalities.set(id, newPersonality);
    return newPersonality;
  }

  async updateMarketplacePersonality(id: string, updates: Partial<PersonalityMarketplace>): Promise<PersonalityMarketplace | undefined> {
    const personality = this.marketplacePersonalities.get(id);
    if (!personality) return undefined;

    const updated = { ...personality, ...updates, updatedAt: new Date() };
    this.marketplacePersonalities.set(id, updated);
    return updated;
  }

  async deleteMarketplacePersonality(id: string): Promise<boolean> {
    return this.marketplacePersonalities.delete(id);
  }

  async voteOnPersonality(vote: InsertPersonalityVote): Promise<PersonalityVote> {
    const voteId = randomUUID();
    const newVote: PersonalityVote = {
      ...vote,
      id: voteId,
      createdAt: new Date(),
    };

    // Remove existing vote if any
    const existingVoteKey = Array.from(this.personalityVotes.entries())
      .find(([_, v]) => v.personalityId === vote.personalityId && v.userId === vote.userId)?.[0];
    
    if (existingVoteKey) {
      const existingVote = this.personalityVotes.get(existingVoteKey)!;
      this.personalityVotes.delete(existingVoteKey);
      
      // Update personality vote count
      const personality = this.marketplacePersonalities.get(vote.personalityId);
      if (personality) {
        if (existingVote.voteType === 'upvote') personality.upvotes--;
        else personality.downvotes--;
      }
    }

    this.personalityVotes.set(voteId, newVote);
    
    // Update personality vote count
    const personality = this.marketplacePersonalities.get(vote.personalityId);
    if (personality) {
      if (vote.voteType === 'upvote') personality.upvotes++;
      else personality.downvotes++;
    }

    return newVote;
  }

  async getUserVote(personalityId: string, userId: string): Promise<PersonalityVote | undefined> {
    return Array.from(this.personalityVotes.values())
      .find(vote => vote.personalityId === personalityId && vote.userId === userId);
  }

  async downloadPersonality(download: InsertPersonalityDownload): Promise<PersonalityDownload> {
    const downloadId = randomUUID();
    const newDownload: PersonalityDownload = {
      ...download,
      id: downloadId,
      createdAt: new Date(),
    };

    this.personalityDownloads.set(downloadId, newDownload);
    
    // Increment download count
    const personality = this.marketplacePersonalities.get(download.personalityId);
    if (personality) {
      personality.downloads++;
    }

    return newDownload;
  }

  async getUserPersonalities(userId: string): Promise<PersonalityMarketplace[]> {
    return Array.from(this.marketplacePersonalities.values())
      .filter(p => p.authorId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async searchPersonalities(query: string, category?: string): Promise<PersonalityMarketplace[]> {
    const searchTerm = query.toLowerCase();
    return Array.from(this.marketplacePersonalities.values())
      .filter(p => 
        p.isActive &&
        (!category || p.category === category) &&
        (p.name.toLowerCase().includes(searchTerm) || 
         p.description.toLowerCase().includes(searchTerm) ||
         (Array.isArray(p.tags) ? p.tags : []).some((tag: string) => tag.toLowerCase().includes(searchTerm)))
      )
      .sort((a, b) => (b.downloads + b.upvotes) - (a.downloads + a.upvotes));
  }

  // Custom voice methods
  async saveCustomVoice(voice: InsertCustomVoice): Promise<CustomVoice> {
    const id = randomUUID();
    const newVoice: CustomVoice = {
      ...voice,
      id,
      createdAt: new Date(),
    };
    this.customVoices.set(id, newVoice);
    return newVoice;
  }

  async getCustomVoices(userId: string): Promise<CustomVoice[]> {
    return Array.from(this.customVoices.values())
      .filter(voice => voice.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async deleteCustomVoice(voiceId: string, userId: string): Promise<boolean> {
    const voice = this.customVoices.get(voiceId);
    if (!voice || voice.userId !== userId) return false;
    return this.customVoices.delete(voiceId);
  }

  // Voice marketplace methods
  async createVoiceMarketplace(voice: InsertVoiceMarketplace): Promise<VoiceMarketplace> {
    const id = randomUUID();
    const newVoice: VoiceMarketplace = {
      ...voice,
      id,
      downloads: 0,
      upvotes: 0,
      downvotes: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.voiceMarketplace.set(id, newVoice);
    return newVoice;
  }

  async getVoiceMarketplace(category?: string, sortBy: 'popular' | 'recent' | 'trending' = 'popular', limit: number = 20): Promise<VoiceMarketplace[]> {
    const voices = Array.from(this.voiceMarketplace.values())
      .filter(v => v.isActive && (!category || v.category === category));

    switch (sortBy) {
      case 'popular':
        return voices.sort((a, b) => (b.downloads + b.upvotes) - (a.downloads + a.upvotes)).slice(0, limit);
      case 'recent':
        return voices.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
      case 'trending':
        return voices.sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes)).slice(0, limit);
      default:
        return voices.slice(0, limit);
    }
  }

  async getVoiceById(id: string): Promise<VoiceMarketplace | undefined> {
    return this.voiceMarketplace.get(id);
  }

  async voteOnVoice(vote: InsertVoiceVote): Promise<VoiceVote> {
    const voteId = randomUUID();
    const newVote: VoiceVote = {
      ...vote,
      id: voteId,
      createdAt: new Date(),
    };
    this.voiceVotes.set(voteId, newVote);
    
    // Update voice vote count
    const voice = this.voiceMarketplace.get(vote.voiceId);
    if (voice) {
      if (vote.voteType === 'upvote') voice.upvotes++;
      else voice.downvotes++;
    }
    
    return newVote;
  }

  async downloadVoice(download: InsertVoiceDownload): Promise<VoiceDownload> {
    const downloadId = randomUUID();
    const newDownload: VoiceDownload = {
      ...download,
      id: downloadId,
      createdAt: new Date(),
    };
    this.voiceDownloads.set(downloadId, newDownload);
    
    // Increment download count
    const voice = this.voiceMarketplace.get(download.voiceId);
    if (voice) {
      voice.downloads++;
    }
    
    return newDownload;
  }
}

export class DatabaseStorage implements IStorage {
  // User methods (required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // First check if user exists by email
    const existingUser = await this.getUserByEmail(userData.email || '');
    
    if (existingUser) {
      // Update existing user but preserve the original ID
      // Never change the user ID as it would violate foreign key constraints
      const { id, ...updateData } = userData;
      const [user] = await db
        .update(users)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id))
        .returning();
      return user;
    }
    
    // Create new user
    const [user] = await db
      .insert(users)
      .values(userData)
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
    const isPro = user?.isPro ?? false;
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

  async reactivateGuildLink(guildId: string, workspaceId: string, linkedByUserId: string): Promise<void> {
    await db
      .update(guildLinks)
      .set({ 
        active: true,
        workspaceId,
        linkedByUserId,
      })
      .where(eq(guildLinks.guildId, guildId));
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
  async createContextMemory(memory: InsertContextMemory): Promise<ContextMemory> {
    const [result] = await db.insert(contextMemory).values(memory).returning();
    return result;
  }

  async getRecentContext(userId: string, guildId?: string, limit: number = 10): Promise<ContextMemory[]> {
    const now = new Date();
    let query = db
      .select()
      .from(contextMemory)
      .where(
        and(
          eq(contextMemory.userId, userId),
          sql`${contextMemory.expiresAt} > ${now}`
        )
      );

    if (guildId) {
      query = query.where(eq(contextMemory.guildId, guildId));
    }

    return await query
      .orderBy(desc(contextMemory.createdAt))
      .limit(limit);
  }

  async getContextByEventType(userId: string, eventType: string, guildId?: string, limit: number = 5): Promise<ContextMemory[]> {
    const now = new Date();
    let query = db
      .select()
      .from(contextMemory)
      .where(
        and(
          eq(contextMemory.userId, userId),
          eq(contextMemory.eventType, eventType),
          sql`${contextMemory.expiresAt} > ${now}`
        )
      );

    if (guildId) {
      query = query.where(eq(contextMemory.guildId, guildId));
    }

    return await query
      .orderBy(desc(contextMemory.createdAt))
      .limit(limit);
  }

  async cleanExpiredContext(): Promise<number> {
    const now = new Date();
    const result = await db
      .delete(contextMemory)
      .where(sql`${contextMemory.expiresAt} <= ${now}`);
    
    return result.rowCount || 0;
  }

  async getContextSummary(userId: string, guildId?: string): Promise<string> {
    const recentContext = await this.getRecentContext(userId, guildId, 5);
    
    if (recentContext.length === 0) {
      return "No recent activity to remember.";
    }

    const summaries = recentContext
      .map(ctx => ctx.contextSummary)
      .filter(summary => summary)
      .join('. ');

    return summaries || "Recent stream activity occurred.";
  }

  // Marketplace methods
  async getMarketplacePersonalities(category?: string, sortBy: 'popular' | 'recent' | 'trending' = 'popular', limit: number = 20): Promise<PersonalityMarketplace[]> {
    let query = db.select().from(personalityMarketplace).where(eq(personalityMarketplace.isActive, true));

    if (category) {
      query = query.where(eq(personalityMarketplace.category, category));
    }

    switch (sortBy) {
      case 'popular':
        return await query
          .orderBy(desc(sql`${personalityMarketplace.downloads} + ${personalityMarketplace.upvotes}`))
          .limit(limit);
      case 'recent':
        return await query.orderBy(desc(personalityMarketplace.createdAt)).limit(limit);
      case 'trending':
        return await query
          .orderBy(desc(sql`${personalityMarketplace.upvotes} - ${personalityMarketplace.downvotes}`))
          .limit(limit);
      default:
        return await query.limit(limit);
    }
  }

  async getPersonalityById(id: string): Promise<PersonalityMarketplace | undefined> {
    const [personality] = await db.select().from(personalityMarketplace).where(eq(personalityMarketplace.id, id));
    return personality;
  }

  async createMarketplacePersonality(personality: InsertPersonalityMarketplace): Promise<PersonalityMarketplace> {
    const [result] = await db.insert(personalityMarketplace).values(personality).returning();
    return result;
  }

  async updateMarketplacePersonality(id: string, updates: Partial<PersonalityMarketplace>): Promise<PersonalityMarketplace | undefined> {
    const [personality] = await db
      .update(personalityMarketplace)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(personalityMarketplace.id, id))
      .returning();
    return personality;
  }

  async deleteMarketplacePersonality(id: string): Promise<boolean> {
    const result = await db.delete(personalityMarketplace).where(eq(personalityMarketplace.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async voteOnPersonality(vote: InsertPersonalityVote): Promise<PersonalityVote> {
    // Remove existing vote if any
    await db.delete(personalityVotes).where(
      and(
        eq(personalityVotes.personalityId, vote.personalityId),
        eq(personalityVotes.userId, vote.userId)
      )
    );

    const [newVote] = await db.insert(personalityVotes).values(vote).returning();
    
    // Update personality vote counts
    if (vote.voteType === 'upvote') {
      await db
        .update(personalityMarketplace)
        .set({ upvotes: sql`${personalityMarketplace.upvotes} + 1` })
        .where(eq(personalityMarketplace.id, vote.personalityId));
    } else {
      await db
        .update(personalityMarketplace)
        .set({ downvotes: sql`${personalityMarketplace.downvotes} + 1` })
        .where(eq(personalityMarketplace.id, vote.personalityId));
    }

    return newVote;
  }

  async getUserVote(personalityId: string, userId: string): Promise<PersonalityVote | undefined> {
    const [vote] = await db
      .select()
      .from(personalityVotes)
      .where(
        and(
          eq(personalityVotes.personalityId, personalityId),
          eq(personalityVotes.userId, userId)
        )
      );
    return vote;
  }

  async downloadPersonality(download: InsertPersonalityDownload): Promise<PersonalityDownload> {
    const [newDownload] = await db.insert(personalityDownloads).values(download).returning();
    
    // Increment download count
    await db
      .update(personalityMarketplace)
      .set({ downloads: sql`${personalityMarketplace.downloads} + 1` })
      .where(eq(personalityMarketplace.id, download.personalityId));

    return newDownload;
  }

  async getUserPersonalities(userId: string): Promise<PersonalityMarketplace[]> {
    return await db
      .select()
      .from(personalityMarketplace)
      .where(eq(personalityMarketplace.authorId, userId))
      .orderBy(desc(personalityMarketplace.createdAt));
  }

  async searchPersonalities(query: string, category?: string): Promise<PersonalityMarketplace[]> {
    let dbQuery = db
      .select()
      .from(personalityMarketplace)
      .where(
        and(
          eq(personalityMarketplace.isActive, true),
          sql`(${personalityMarketplace.name} ILIKE ${'%' + query + '%'} OR ${personalityMarketplace.description} ILIKE ${'%' + query + '%'})`
        )
      );

    if (category) {
      dbQuery = dbQuery.where(eq(personalityMarketplace.category, category));
    }

    return await dbQuery
      .orderBy(desc(sql`${personalityMarketplace.downloads} + ${personalityMarketplace.upvotes}`));
  }

  // Custom voice methods
  async saveCustomVoice(voice: InsertCustomVoice): Promise<CustomVoice> {
    const [newVoice] = await db.insert(customVoices).values(voice).returning();
    return newVoice;
  }

  async getCustomVoices(userId: string): Promise<CustomVoice[]> {
    return await db
      .select()
      .from(customVoices)
      .where(eq(customVoices.userId, userId))
      .orderBy(desc(customVoices.createdAt));
  }

  async deleteCustomVoice(voiceId: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(customVoices)
      .where(
        and(
          eq(customVoices.id, voiceId),
          eq(customVoices.userId, userId)
        )
      );
    return (result.rowCount || 0) > 0;
  }

  // Voice marketplace methods
  async createVoiceMarketplace(voice: InsertVoiceMarketplace): Promise<VoiceMarketplace> {
    const [newVoice] = await db.insert(voiceMarketplace).values(voice).returning();
    return newVoice;
  }

  async getMarketplaceVoices(category?: string, sortBy: 'popular' | 'recent' | 'downloads' = 'recent', limit: number = 20): Promise<VoiceMarketplace[]> {
    let query = db.select().from(voiceMarketplace).where(eq(voiceMarketplace.isActive, true));
    
    if (category && category !== 'all') {
      query = query.where(eq(voiceMarketplace.category, category));
    }
    
    switch (sortBy) {
      case 'popular':
        query = query.orderBy(desc(voiceMarketplace.upvotes));
        break;
      case 'downloads':
        query = query.orderBy(desc(voiceMarketplace.downloads));
        break;
      case 'recent':
      default:
        query = query.orderBy(desc(voiceMarketplace.createdAt));
        break;
    }
    
    return query.limit(limit);
  }

  async getMarketplaceVoiceById(id: string): Promise<VoiceMarketplace | undefined> {
    const [voice] = await db.select().from(voiceMarketplace).where(eq(voiceMarketplace.id, id));
    return voice;
  }

  async incrementVoiceDownloads(id: string): Promise<void> {
    await db.update(voiceMarketplace)
      .set({ downloads: sql`${voiceMarketplace.downloads} + 1` })
      .where(eq(voiceMarketplace.id, id));
  }

  async searchMarketplaceVoices(query: string, category?: string): Promise<VoiceMarketplace[]> {
    let searchQuery = db.select().from(voiceMarketplace)
      .where(and(
        eq(voiceMarketplace.isActive, true),
        or(
          ilike(voiceMarketplace.name, `%${query}%`),
          ilike(voiceMarketplace.description, `%${query}%`)
        )
      ));
    
    if (category && category !== 'all') {
      searchQuery = searchQuery.where(eq(voiceMarketplace.category, category));
    }
    
    return searchQuery.orderBy(desc(voiceMarketplace.downloads)).limit(20);
  }

  async getVoiceMarketplace(category?: string, sortBy: 'popular' | 'recent' | 'trending' = 'popular', limit: number = 20): Promise<VoiceMarketplace[]> {
    let query = db.select().from(voiceMarketplace).where(eq(voiceMarketplace.isActive, true));

    if (category) {
      query = query.where(eq(voiceMarketplace.category, category));
    }

    switch (sortBy) {
      case 'popular':
        return await query
          .orderBy(desc(sql`${voiceMarketplace.downloads} + ${voiceMarketplace.upvotes}`))
          .limit(limit);
      case 'recent':
        return await query
          .orderBy(desc(voiceMarketplace.createdAt))
          .limit(limit);
      case 'trending':
        return await query
          .orderBy(desc(sql`${voiceMarketplace.upvotes} - ${voiceMarketplace.downvotes}`))
          .limit(limit);
      default:
        return await query.limit(limit);
    }
  }

  async getVoiceById(id: string): Promise<VoiceMarketplace | undefined> {
    const [voice] = await db.select().from(voiceMarketplace).where(eq(voiceMarketplace.id, id));
    return voice;
  }

  async voteOnVoice(vote: InsertVoiceVote): Promise<VoiceVote> {
    const [newVote] = await db.insert(voiceVotes).values(vote).returning();
    
    // Update voice vote counts
    if (vote.voteType === 'upvote') {
      await db
        .update(voiceMarketplace)
        .set({ upvotes: sql`${voiceMarketplace.upvotes} + 1` })
        .where(eq(voiceMarketplace.id, vote.voiceId));
    } else {
      await db
        .update(voiceMarketplace)
        .set({ downvotes: sql`${voiceMarketplace.downvotes} + 1` })
        .where(eq(voiceMarketplace.id, vote.voiceId));
    }

    return newVote;
  }

  async downloadVoice(download: InsertVoiceDownload): Promise<VoiceDownload> {
    const [newDownload] = await db.insert(voiceDownloads).values(download).returning();
    
    // Increment download count
    await db
      .update(voiceMarketplace)
      .set({ downloads: sql`${voiceMarketplace.downloads} + 1` })
      .where(eq(voiceMarketplace.id, download.voiceId));

    return newDownload;
  }
}

export const storage = new DatabaseStorage();
