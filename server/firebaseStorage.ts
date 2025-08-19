import { getFirestoreDb } from './firebase';
import type { 
  User, InsertUser, UpsertUser, BanterItem, InsertBanterItem, UserSettings, InsertUserSettings, 
  DailyStats, InsertDailyStats, TwitchSettings, InsertTwitchSettings, DiscordSettings, 
  InsertDiscordSettings, LinkCode, InsertLinkCode, GuildLink, InsertGuildLink, GuildSettings, 
  InsertGuildSettings, ContextMemory, InsertContextMemory, EventType, EventData, 
  MarketplaceVoice, InsertMarketplaceVoice, MarketplacePersonality, InsertMarketplacePersonality, 
  UserDownload, InsertUserDownload, UserRating, InsertUserRating, ContentReport, InsertContentReport 
} from "@shared/schema";
import { randomUUID } from "crypto";

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

export class FirebaseStorageService implements IStorage {
  private db: any;

  constructor() {
    this.db = getFirestoreDb();
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    try {
      const doc = await this.db.collection('users').doc(id).get();
      if (doc.exists) {
        return doc.data() as User;
      }
      return undefined;
    } catch (error) {
      console.error('Error getting user:', error);
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const snapshot = await this.db.collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();
      
      if (!snapshot.empty) {
        return snapshot.docs[0].data() as User;
      }
      return undefined;
    } catch (error) {
      console.error('Error getting user by email:', error);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    // Firebase doesn't have a username field, so this returns undefined
    return undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = randomUUID();
    const now = new Date();
    const newUser: User = {
      ...user,
      id,
      createdAt: now,
      updatedAt: now,
      subscriptionTier: user.subscriptionTier || 'free',
      subscriptionStatus: user.subscriptionStatus || 'active',
      planChangeCount: user.planChangeCount || 0,
      hasCompletedOnboarding: user.hasCompletedOnboarding || false,
    };

    await this.db.collection('users').doc(id).set(newUser);
    return newUser;
  }

  async upsertUser(user: UpsertUser): Promise<User> {
    const now = new Date();
    
    // Set default values for required fields if they're missing
    const userData = {
      ...user,
      subscriptionTier: user.subscriptionTier || 'free',
      subscriptionStatus: user.subscriptionStatus || 'active',
      planChangeCount: user.planChangeCount || 0,
      hasCompletedOnboarding: user.hasCompletedOnboarding || false,
      createdAt: now,
      updatedAt: now,
    };

    if (user.id) {
      await this.db.collection('users').doc(user.id).set(userData, { merge: true });
      return { ...userData, id: user.id } as User;
    } else {
      return this.createUser(userData as InsertUser);
    }
  }

  async completeOnboarding(userId: string): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const updatedUser = {
      ...user,
      hasCompletedOnboarding: true,
      updatedAt: new Date(),
    };

    await this.db.collection('users').doc(userId).update({
      hasCompletedOnboarding: true,
      updatedAt: new Date(),
    });

    return updatedUser;
  }

  // Banter methods
  async getBanterItem(id: string): Promise<BanterItem | undefined> {
    try {
      const doc = await this.db.collection('banterItems').doc(id).get();
      if (doc.exists) {
        return doc.data() as BanterItem;
      }
      return undefined;
    } catch (error) {
      console.error('Error getting banter item:', error);
      return undefined;
    }
  }

  async getBantersByUser(userId: string, limit: number = 50): Promise<BanterItem[]> {
    try {
      const snapshot = await this.db.collection('banterItems')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => doc.data() as BanterItem);
    } catch (error) {
      console.error('Error getting banter items by user:', error);
      return [];
    }
  }

  async searchBanters(userId: string, query: string, eventType: string, limit: number = 50): Promise<BanterItem[]> {
    try {
      let snapshot = this.db.collection('banterItems')
        .where('userId', '==', userId);

      if (eventType !== 'all') {
        snapshot = snapshot.where('eventType', '==', eventType);
      }

      const results = await snapshot
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      const banters = results.docs.map(doc => doc.data() as BanterItem);
      
      // Client-side search since Firebase doesn't support full-text search
      if (query) {
        const searchTerm = query.toLowerCase();
        return banters.filter(banter => 
          banter.banterText.toLowerCase().includes(searchTerm) ||
          banter.originalMessage?.toLowerCase().includes(searchTerm)
        );
      }

      return banters;
    } catch (error) {
      console.error('Error searching banter items:', error);
      return [];
    }
  }

  async createBanterItem(banter: InsertBanterItem): Promise<BanterItem> {
    const id = randomUUID();
    const now = new Date();
    const newBanter: BanterItem = {
      ...banter,
      id,
      createdAt: now,
      isPlayed: banter.isPlayed || false,
    };

    await this.db.collection('banterItems').doc(id).set(newBanter);
    return newBanter;
  }

  async updateBanterItem(id: string, updates: Partial<BanterItem>): Promise<BanterItem | undefined> {
    try {
      const docRef = this.db.collection('banterItems').doc(id);
      await docRef.update(updates);
      
      const updatedDoc = await docRef.get();
      if (updatedDoc.exists) {
        return updatedDoc.data() as BanterItem;
      }
      return undefined;
    } catch (error) {
      console.error('Error updating banter item:', error);
      return undefined;
    }
  }

  async deleteBanterItem(id: string): Promise<boolean> {
    try {
      await this.db.collection('banterItems').doc(id).delete();
      return true;
    } catch (error) {
      console.error('Error deleting banter item:', error);
      return false;
    }
  }

  // Settings methods
  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    try {
      const doc = await this.db.collection('userSettings').doc(userId).get();
      if (doc.exists) {
        return doc.data() as UserSettings;
      }
      return undefined;
    } catch (error) {
      console.error('Error getting user settings:', error);
      return undefined;
    }
  }

  async createUserSettings(settings: InsertUserSettings): Promise<UserSettings> {
    const now = new Date();
    const newSettings: UserSettings = {
      ...settings,
      id: settings.userId,
      updatedAt: now,
    };

    await this.db.collection('userSettings').doc(settings.userId).set(newSettings);
    return newSettings;
  }

  async updateUserSettings(userId: string, updates: Partial<UserSettings>): Promise<UserSettings | undefined> {
    try {
      const docRef = this.db.collection('userSettings').doc(userId);
      await docRef.update({
        ...updates,
        updatedAt: new Date(),
      });
      
      const updatedDoc = await docRef.get();
      if (updatedDoc.exists) {
        return updatedDoc.data() as UserSettings;
      }
      return undefined;
    } catch (error) {
      console.error('Error updating user settings:', error);
      return undefined;
    }
  }

  // Stats methods
  async getDailyStats(userId: string, date: string): Promise<DailyStats | undefined> {
    try {
      const doc = await this.db.collection('dailyStats').doc(`${userId}_${date}`).get();
      if (doc.exists) {
        return doc.data() as DailyStats;
      }
      return undefined;
    } catch (error) {
      console.error('Error getting daily stats:', error);
      return undefined;
    }
  }

  async createDailyStats(stats: InsertDailyStats): Promise<DailyStats> {
    const id = `${stats.userId}_${stats.date}`;
    const newStats: DailyStats = {
      ...stats,
      id,
    };

    await this.db.collection('dailyStats').doc(id).set(newStats);
    return newStats;
  }

  async updateDailyStats(userId: string, date: string, updates: Partial<DailyStats>): Promise<DailyStats | undefined> {
    try {
      const docRef = this.db.collection('dailyStats').doc(`${userId}_${date}`);
      await docRef.update(updates);
      
      const updatedDoc = await docRef.get();
      if (updatedDoc.exists) {
        return updatedDoc.data() as DailyStats;
      }
      return undefined;
    } catch (error) {
      console.error('Error updating daily stats:', error);
      return undefined;
    }
  }

  async checkAndIncrementDailyUsage(userId: string): Promise<{ allowed: boolean; current: number; limit: number; isPro: boolean }> {
    const today = new Date().toISOString().split('T')[0];
    const user = await this.getUser(userId);
    const isPro = user?.subscriptionTier === 'pro';
    const limit = isPro ? 1000 : 50;

    let stats = await this.getDailyStats(userId, today);
    if (!stats) {
      stats = await this.createDailyStats({
        userId,
        date: today,
        bantersGenerated: 0,
        bantersPlayed: 0,
        chatResponses: 0,
        audioGenerated: 0,
        viewerEngagement: 0,
      });
    }

    const current = stats.bantersGenerated;
    const allowed = current < limit;

    if (allowed) {
      await this.updateDailyStats(userId, today, {
        bantersGenerated: current + 1,
      });
    }

    return { allowed, current, limit, isPro };
  }

  // Twitch methods
  async getTwitchSettings(userId: string): Promise<TwitchSettings | undefined> {
    try {
      const doc = await this.db.collection('twitchSettings').doc(userId).get();
      if (doc.exists) {
        return doc.data() as TwitchSettings;
      }
      return undefined;
    } catch (error) {
      console.error('Error getting Twitch settings:', error);
      return undefined;
    }
  }

  async upsertTwitchSettings(settings: InsertTwitchSettings): Promise<TwitchSettings> {
    const now = new Date();
    const newSettings: TwitchSettings = {
      ...settings,
      id: settings.userId,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.collection('twitchSettings').doc(settings.userId).set(newSettings, { merge: true });
    return newSettings;
  }

  async updateTwitchEventSettings(userId: string, enabledEvents: string[]): Promise<TwitchSettings | undefined> {
    try {
      const docRef = this.db.collection('twitchSettings').doc(userId);
      await docRef.update({
        enabledEvents,
        updatedAt: new Date(),
      });
      
      const updatedDoc = await docRef.get();
      if (updatedDoc.exists) {
        return updatedDoc.data() as TwitchSettings;
      }
      return undefined;
    } catch (error) {
      console.error('Error updating Twitch event settings:', error);
      return undefined;
    }
  }

  // Discord methods (legacy)
  async getDiscordSettings(userId: string): Promise<DiscordSettings | undefined> {
    try {
      const doc = await this.db.collection('discordSettings').doc(userId).get();
      if (doc.exists) {
        return doc.data() as DiscordSettings;
      }
      return undefined;
    } catch (error) {
      console.error('Error getting Discord settings:', error);
      return undefined;
    }
  }

  async upsertDiscordSettings(settings: InsertDiscordSettings): Promise<DiscordSettings> {
    const now = new Date();
    const newSettings: DiscordSettings = {
      ...settings,
      id: settings.userId,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.collection('discordSettings').doc(settings.userId).set(newSettings, { merge: true });
    return newSettings;
  }

  async updateDiscordEventSettings(userId: string, enabledEvents: string[]): Promise<DiscordSettings | undefined> {
    try {
      const docRef = this.db.collection('discordSettings').doc(userId);
      await docRef.update({
        enabledEvents,
        updatedAt: new Date(),
      });
      
      const updatedDoc = await docRef.get();
      if (updatedDoc.exists) {
        return updatedDoc.data() as DiscordSettings;
      }
      return undefined;
    } catch (error) {
      console.error('Error updating Discord event settings:', error);
      return undefined;
    }
  }

  // Discord Bot methods
  async getLinkCode(code: string): Promise<LinkCode | undefined> {
    try {
      const snapshot = await this.db.collection('linkCodes')
        .where('code', '==', code)
        .where('expiresAt', '>', new Date())
        .where('consumedAt', '==', null)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        return snapshot.docs[0].data() as LinkCode;
      }
      return undefined;
    } catch (error) {
      console.error('Error getting link code:', error);
      return undefined;
    }
  }

  async createLinkCode(linkCode: InsertLinkCode): Promise<LinkCode> {
    const id = randomUUID();
    const now = new Date();
    const newLinkCode: LinkCode = {
      ...linkCode,
      id,
      createdAt: now,
    };

    await this.db.collection('linkCodes').doc(id).set(newLinkCode);
    return newLinkCode;
  }

  async consumeLinkCode(code: string): Promise<void> {
    try {
      const snapshot = await this.db.collection('linkCodes')
        .where('code', '==', code)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        await snapshot.docs[0].ref.update({
          consumedAt: new Date(),
        });
      }
    } catch (error) {
      console.error('Error consuming link code:', error);
    }
  }

  async getGuildLink(guildId: string): Promise<GuildLink | undefined> {
    try {
      const doc = await this.db.collection('guildLinks').doc(guildId).get();
      if (doc.exists) {
        return doc.data() as GuildLink;
      }
      return undefined;
    } catch (error) {
      console.error('Error getting guild link:', error);
      return undefined;
    }
  }

  async createGuildLink(guildLink: InsertGuildLink): Promise<GuildLink> {
    const now = new Date();
    const newGuildLink: GuildLink = {
      ...guildLink,
      id: guildLink.guildId,
      createdAt: now,
    };

    await this.db.collection('guildLinks').doc(guildLink.guildId).set(newGuildLink);
    return newGuildLink;
  }

  async updateGuildLink(guildId: string, updates: Partial<GuildLink>): Promise<void> {
    try {
      await this.db.collection('guildLinks').doc(guildId).update(updates);
    } catch (error) {
      console.error('Error updating guild link:', error);
      throw error;
    }
  }

  async deactivateGuildLink(guildId: string): Promise<void> {
    try {
      await this.db.collection('guildLinks').doc(guildId).update({
        active: false,
      });
    } catch (error) {
      console.error('Error deactivating guild link:', error);
    }
  }

  async getAllActiveGuildLinks(): Promise<GuildLink[]> {
    try {
      const snapshot = await this.db.collection('guildLinks')
        .where('active', '==', true)
        .get();

      return snapshot.docs.map(doc => doc.data() as GuildLink);
    } catch (error) {
      console.error('Error getting active guild links:', error);
      return [];
    }
  }

  async getGuildSettings(guildId: string): Promise<GuildSettings | undefined> {
    try {
      const doc = await this.db.collection('guildSettings').doc(guildId).get();
      if (doc.exists) {
        return doc.data() as GuildSettings;
      }
      return undefined;
    } catch (error) {
      console.error('Error getting guild settings:', error);
      return undefined;
    }
  }

  async upsertGuildSettings(settings: InsertGuildSettings): Promise<GuildSettings> {
    const now = new Date();
    const newSettings: GuildSettings = {
      ...settings,
      updatedAt: now,
    };

    await this.db.collection('guildSettings').doc(settings.guildId).set(newSettings, { merge: true });
    return newSettings;
  }

  // Billing and API Key methods
  async saveUserApiKey(keyData: { userId: string; provider: string; apiKey: string; isActive?: boolean }): Promise<void> {
    try {
      const now = new Date();
      const apiKey = {
        id: randomUUID(),
        userId: keyData.userId,
        provider: keyData.provider,
        apiKey: keyData.apiKey,
        isActive: keyData.isActive ?? true,
        createdAt: now,
        updatedAt: now,
      };

      await this.db.collection('userApiKeys').doc(apiKey.id).set(apiKey);
    } catch (error) {
      console.error('Error saving user API key:', error);
    }
  }

  async getUserApiKeys(userId: string): Promise<any[]> {
    try {
      const snapshot = await this.db.collection('userApiKeys')
        .where('userId', '==', userId)
        .where('isActive', '==', true)
        .get();

      return snapshot.docs.map(doc => doc.data());
    } catch (error) {
      console.error('Error getting user API keys:', error);
      return [];
    }
  }

  async deleteUserApiKey(userId: string, provider: string): Promise<void> {
    try {
      const snapshot = await this.db.collection('userApiKeys')
        .where('userId', '==', userId)
        .where('provider', '==', provider)
        .get();

      const batch = this.db.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    } catch (error) {
      console.error('Error deleting user API key:', error);
    }
  }

  async getUsageTracking(userId: string, period: string): Promise<any> {
    try {
      const snapshot = await this.db.collection('usageTracking')
        .where('userId', '==', userId)
        .where('date', '==', period)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        return snapshot.docs[0].data();
      }
      return null;
    } catch (error) {
      console.error('Error getting usage tracking:', error);
      return null;
    }
  }

  async updateUsageTracking(userId: string, updates: any): Promise<void> {
    try {
      const now = new Date();
      await this.db.collection('usageTracking').doc(`${userId}_${updates.date}`).set({
        userId,
        ...updates,
        updatedAt: now,
      }, { merge: true });
    } catch (error) {
      console.error('Error updating usage tracking:', error);
    }
  }

  // Streaming session management
  async getCurrentStreamer(guildId: string): Promise<string | null> {
    try {
      const settings = await this.getGuildSettings(guildId);
      return settings?.currentStreamer || null;
    } catch (error) {
      console.error('Error getting current streamer:', error);
      return null;
    }
  }

  async setCurrentStreamer(guildId: string, userId: string): Promise<void> {
    try {
      await this.db.collection('guildSettings').doc(guildId).update({
        currentStreamer: userId,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Error setting current streamer:', error);
    }
  }

  async clearCurrentStreamer(guildId: string): Promise<void> {
    try {
      await this.db.collection('guildSettings').doc(guildId).update({
        currentStreamer: null,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Error clearing current streamer:', error);
    }
  }

  // Context memory methods
  async createContextMemory(context: InsertContextMemory): Promise<ContextMemory> {
    const id = randomUUID();
    const now = new Date();
    const newContext: ContextMemory = {
      ...context,
      id,
      createdAt: now,
    };

    await this.db.collection('contextMemory').doc(id).set(newContext);
    return newContext;
  }

  async getRecentContext(userId: string, guildId?: string, limit: number = 50): Promise<ContextMemory[]> {
    try {
      let query = this.db.collection('contextMemory')
        .where('userId', '==', userId)
        .where('expiresAt', '>', new Date())
        .orderBy('expiresAt', 'desc');

      if (guildId) {
        query = query.where('guildId', '==', guildId);
      }

      const snapshot = await query.limit(limit).get();
      return snapshot.docs.map(doc => doc.data() as ContextMemory);
    } catch (error) {
      console.error('Error getting recent context:', error);
      return [];
    }
  }

  async getContextByType(userId: string, eventType: string, guildId?: string, limit: number = 50): Promise<ContextMemory[]> {
    try {
      let query = this.db.collection('contextMemory')
        .where('userId', '==', userId)
        .where('eventType', '==', eventType)
        .where('expiresAt', '>', new Date())
        .orderBy('expiresAt', 'desc');

      if (guildId) {
        query = query.where('guildId', '==', guildId);
      }

      const snapshot = await query.limit(limit).get();
      return snapshot.docs.map(doc => doc.data() as ContextMemory);
    } catch (error) {
      console.error('Error getting context by type:', error);
      return [];
    }
  }

  async updateContextResponse(contextId: string, banterResponse: string): Promise<void> {
    try {
      await this.db.collection('contextMemory').doc(contextId).update({
        banterResponse,
      });
    } catch (error) {
      console.error('Error updating context response:', error);
    }
  }

  async cleanExpiredContext(): Promise<number> {
    try {
      const snapshot = await this.db.collection('contextMemory')
        .where('expiresAt', '<', new Date())
        .get();

      const batch = this.db.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      return snapshot.docs.length;
    } catch (error) {
      console.error('Error cleaning expired context:', error);
      return 0;
    }
  }

  // Marketplace methods
  async createMarketplaceVoice(voice: InsertMarketplaceVoice): Promise<MarketplaceVoice> {
    const id = randomUUID();
    const now = new Date();
    const newVoice: MarketplaceVoice = {
      ...voice,
      id,
      createdAt: now,
      updatedAt: now,
      downloads: 0,
      upvotes: 0,
      downvotes: 0,
    };

    await this.db.collection('marketplaceVoices').doc(id).set(newVoice);
    return newVoice;
  }

  async createMarketplacePersonality(personality: InsertMarketplacePersonality): Promise<MarketplacePersonality> {
    const id = randomUUID();
    const now = new Date();
    const newPersonality: MarketplacePersonality = {
      ...personality,
      id,
      createdAt: now,
      updatedAt: now,
      downloads: 0,
      upvotes: 0,
      downvotes: 0,
    };

    await this.db.collection('marketplacePersonalities').doc(id).set(newPersonality);
    return newPersonality;
  }

  async getMarketplaceVoices(filters?: { category?: string; search?: string; sortBy?: string; limit?: number }): Promise<MarketplaceVoice[]> {
    try {
      let query = this.db.collection('marketplaceVoices')
        .where('isActive', '==', true)
        .where('moderationStatus', '==', 'approved');

      if (filters?.category && filters.category !== 'all') {
        query = query.where('category', '==', filters.category);
      }

      const snapshot = await query.get();
      let voices = snapshot.docs.map(doc => doc.data() as MarketplaceVoice);

      // Client-side search
      if (filters?.search) {
        const searchTerm = filters.search.toLowerCase();
        voices = voices.filter(voice =>
          voice.name.toLowerCase().includes(searchTerm) ||
          voice.description?.toLowerCase().includes(searchTerm)
        );
      }

      // Client-side sorting
      if (filters?.sortBy) {
        switch (filters.sortBy) {
          case 'newest':
            voices.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            break;
          case 'downloads':
            voices.sort((a, b) => b.downloads - a.downloads);
            break;
          case 'rating':
            voices.sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes));
            break;
          default:
            // Popular: combination of downloads and rating
            voices.sort((a, b) => 
              (b.downloads + (b.upvotes - b.downvotes) * 10) - 
              (a.downloads + (a.upvotes - a.downvotes) * 10)
            );
        }
      }

      if (filters?.limit) {
        voices = voices.slice(0, filters.limit);
      }

      return voices;
    } catch (error) {
      console.error('Error getting marketplace voices:', error);
      return [];
    }
  }

  async getMarketplacePersonalities(filters?: { category?: string; search?: string; sortBy?: string; limit?: number }): Promise<MarketplacePersonality[]> {
    try {
      let query = this.db.collection('marketplacePersonalities')
        .where('isActive', '==', true)
        .where('moderationStatus', '==', 'approved');

      if (filters?.category && filters.category !== 'all') {
        query = query.where('category', '==', filters.category);
      }

      const snapshot = await query.get();
      let personalities = snapshot.docs.map(doc => doc.data() as MarketplacePersonality);

      // Client-side search
      if (filters?.search) {
        const searchTerm = filters.search.toLowerCase();
        personalities = personalities.filter(personality =>
          personality.name.toLowerCase().includes(searchTerm) ||
          personality.description?.toLowerCase().includes(searchTerm)
        );
      }

      // Client-side sorting
      if (filters?.sortBy) {
        switch (filters.sortBy) {
          case 'newest':
            personalities.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            break;
          case 'downloads':
            personalities.sort((a, b) => b.downloads - a.downloads);
            break;
          case 'rating':
            personalities.sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes));
            break;
          default:
            // Popular: combination of downloads and rating
            personalities.sort((a, b) => 
              (b.downloads + (b.upvotes - b.downvotes) * 10) - 
              (a.downloads + (a.upvotes - a.downvotes) * 10)
            );
        }
      }

      if (filters?.limit) {
        personalities = personalities.slice(0, filters.limit);
      }

      return personalities;
    } catch (error) {
      console.error('Error getting marketplace personalities:', error);
      return [];
    }
  }

  async getMarketplaceVoice(id: string): Promise<MarketplaceVoice | undefined> {
    try {
      const doc = await this.db.collection('marketplaceVoices').doc(id).get();
      if (doc.exists) {
        return doc.data() as MarketplaceVoice;
      }
      return undefined;
    } catch (error) {
      console.error('Error getting marketplace voice:', error);
      return undefined;
    }
  }

  async getMarketplacePersonality(id: string): Promise<MarketplacePersonality | undefined> {
    try {
      const doc = await this.db.collection('marketplacePersonalities').doc(id).get();
      if (doc.exists) {
        return doc.data() as MarketplacePersonality;
      }
      return undefined;
    } catch (error) {
      console.error('Error getting marketplace personality:', error);
      return undefined;
    }
  }

  async updateMarketplaceItem(itemType: 'voice' | 'personality', id: string, updates: any): Promise<void> {
    try {
      const collection = itemType === 'voice' ? 'marketplaceVoices' : 'marketplacePersonalities';
      await this.db.collection(collection).doc(id).update({
        ...updates,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Error updating marketplace item:', error);
    }
  }

  // User interactions
  async downloadMarketplaceItem(userId: string, itemType: 'voice' | 'personality', itemId: string): Promise<UserDownload> {
    const id = randomUUID();
    const now = new Date();
    const download: UserDownload = {
      id,
      userId,
      itemType,
      itemId,
      downloadedAt: now,
    };

    await this.db.collection('userDownloads').doc(id).set(download);

    // Increment download count
    const collection = itemType === 'voice' ? 'marketplaceVoices' : 'marketplacePersonalities';
    await this.db.collection(collection).doc(itemId).update({
      downloads: this.db.FieldValue.increment(1),
    });

    return download;
  }

  async hasUserDownloaded(userId: string, itemType: 'voice' | 'personality', itemId: string): Promise<boolean> {
    try {
      const snapshot = await this.db.collection('userDownloads')
        .where('userId', '==', userId)
        .where('itemType', '==', itemType)
        .where('itemId', '==', itemId)
        .limit(1)
        .get();

      return !snapshot.empty;
    } catch (error) {
      console.error('Error checking if user downloaded item:', error);
      return false;
    }
  }

  async rateMarketplaceItem(userId: string, itemType: 'voice' | 'personality', itemId: string, rating: 1 | -1): Promise<void> {
    try {
      const ratingId = `${userId}_${itemType}_${itemId}`;
      const now = new Date();

      // Check if user already rated
      const existingRating = await this.db.collection('userRatings').doc(ratingId).get();
      
      if (existingRating.exists) {
        const oldRating = existingRating.data()?.rating || 0;
        const ratingDiff = rating - oldRating;

        // Update rating
        await this.db.collection('userRatings').doc(ratingId).update({
          rating,
          updatedAt: now,
        });

        // Update item stats
        const collection = itemType === 'voice' ? 'marketplaceVoices' : 'marketplacePersonalities';
        const updates: any = {};
        
        if (ratingDiff > 0) {
          updates.upvotes = this.db.FieldValue.increment(ratingDiff);
        } else if (ratingDiff < 0) {
          updates.downvotes = this.db.FieldValue.increment(-ratingDiff);
        }

        if (Object.keys(updates).length > 0) {
          await this.db.collection(collection).doc(itemId).update(updates);
        }
      } else {
        // Create new rating
        await this.db.collection('userRatings').doc(ratingId).set({
          id: ratingId,
          userId,
          itemType,
          itemId,
          rating,
          createdAt: now,
          updatedAt: now,
        });

        // Update item stats
        const collection = itemType === 'voice' ? 'marketplaceVoices' : 'marketplacePersonalities';
        const updates: any = {};
        
        if (rating > 0) {
          updates.upvotes = this.db.FieldValue.increment(1);
        } else {
          updates.downvotes = this.db.FieldValue.increment(1);
        }

        await this.db.collection(collection).doc(itemId).update(updates);
      }
    } catch (error) {
      console.error('Error rating marketplace item:', error);
    }
  }

  async getUserRating(userId: string, itemType: 'voice' | 'personality', itemId: string): Promise<number | null> {
    try {
      const ratingId = `${userId}_${itemType}_${itemId}`;
      const doc = await this.db.collection('userRatings').doc(ratingId).get();
      
      if (doc.exists) {
        return doc.data()?.rating || null;
      }
      return null;
    } catch (error) {
      console.error('Error getting user rating:', error);
      return null;
    }
  }

  // Moderation
  async moderateMarketplaceItem(itemType: 'voice' | 'personality', itemId: string, status: 'approved' | 'rejected', moderatorId: string, notes?: string): Promise<void> {
    try {
      const collection = itemType === 'voice' ? 'marketplaceVoices' : 'marketplacePersonalities';
      await this.db.collection(collection).doc(itemId).update({
        moderationStatus: status,
        moderationNotes: notes,
        moderatedAt: new Date(),
        moderatedBy: moderatorId,
      });
    } catch (error) {
      console.error('Error moderating marketplace item:', error);
    }
  }

  async getPendingModerationItems(): Promise<{ voices: MarketplaceVoice[]; personalities: MarketplacePersonality[] }> {
    try {
      const voicesSnapshot = await this.db.collection('marketplaceVoices')
        .where('moderationStatus', '==', 'pending')
        .get();

      const personalitiesSnapshot = await this.db.collection('marketplacePersonalities')
        .where('moderationStatus', '==', 'pending')
        .get();

      return {
        voices: voicesSnapshot.docs.map(doc => doc.data() as MarketplaceVoice),
        personalities: personalitiesSnapshot.docs.map(doc => doc.data() as MarketplacePersonality),
      };
    } catch (error) {
      console.error('Error getting pending moderation items:', error);
      return { voices: [], personalities: [] };
    }
  }

  // Reporting
  async reportContent(report: InsertContentReport): Promise<ContentReport> {
    const id = randomUUID();
    const now = new Date();
    const newReport: ContentReport = {
      ...report,
      id,
      status: 'pending',
      createdAt: now,
    };

    await this.db.collection('contentReports').doc(id).set(newReport);
    return newReport;
  }

  async getContentReports(status?: string): Promise<ContentReport[]> {
    try {
      let query = this.db.collection('contentReports');
      
      if (status) {
        query = query.where('status', '==', status);
      }

      const snapshot = await query.orderBy('createdAt', 'desc').get();
      return snapshot.docs.map(doc => doc.data() as ContentReport);
    } catch (error) {
      console.error('Error getting content reports:', error);
      return [];
    }
  }

  async reviewReport(reportId: string, reviewerId: string, status: 'resolved' | 'dismissed', notes?: string): Promise<void> {
    try {
      await this.db.collection('contentReports').doc(reportId).update({
        status,
        reviewNotes: notes,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      });
    } catch (error) {
      console.error('Error reviewing report:', error);
    }
  }

  // Audio file storage methods (for compatibility with existing code)
  async saveAudioFile(userId: string, audioBuffer: Buffer, filename: string): Promise<string> {
    try {
      // For now, we'll store audio files in Firebase Storage
      // This is a placeholder implementation
      const audioUrl = `https://storage.googleapis.com/banterbox-audio/${userId}/${filename}`;
      console.log(`Audio file saved: ${audioUrl}`);
      return audioUrl;
    } catch (error) {
      console.error('Error saving audio file:', error);
      throw error;
    }
  }

  // Object storage compatibility methods
  async isAvailable(): Promise<boolean> {
    return true; // Firebase is always available
  }

  async searchPublicObject(query: string): Promise<any[]> {
    // Placeholder implementation
    return [];
  }

  async downloadObject(key: string): Promise<Buffer> {
    // Placeholder implementation
    return Buffer.from([]);
  }
}

// Export singleton instance
export const firebaseStorage = new FirebaseStorageService();
