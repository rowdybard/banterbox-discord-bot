import { getFirestoreDb } from './firebase';
import { randomUUID } from 'crypto';
import type { 
  User, InsertUser, UpsertUser, 
  BanterItem, InsertBanterItem, 
  UserSettings, InsertUserSettings, 
  DailyStats, InsertDailyStats, 
  TwitchSettings, InsertTwitchSettings, 
  DiscordSettings, InsertDiscordSettings, 
  LinkCode, InsertLinkCode, 
  GuildLink, InsertGuildLink, 
  GuildSettings, InsertGuildSettings, 
  ContextMemory, InsertContextMemory, 
  MarketplaceVoice, InsertMarketplaceVoice, 
  MarketplacePersonality, InsertMarketplacePersonality, 
  UserDownload, InsertUserDownload, 
  UserRating, InsertUserRating, 
  ContentReport, InsertContentReport 
} from '@shared/schema';

export class FirebaseStorage implements IStorage {
  private db: any;

  constructor() {
    this.db = getFirestoreDb();
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    try {
      const doc = await this.db.collection('users').doc(id).get();
      if (doc.exists) {
        return { id: doc.id, ...doc.data() } as User;
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
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() } as User;
      }
      return undefined;
    } catch (error) {
      console.error('Error getting user by email:', error);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    // Firebase doesn't have a username field, so this might not be needed
    return undefined;
  }

  async upsertUser(user: UpsertUser): Promise<User> {
    try {
      const userId = user.id || randomUUID();
      const userData = {
        ...user,
        id: userId,
        updatedAt: new Date(),
        createdAt: user.createdAt || new Date()
      };

      await this.db.collection('users').doc(userId).set(userData, { merge: true });
      return userData as User;
    } catch (error) {
      console.error('Error upserting user:', error);
      throw error;
    }
  }

  async createUser(user: InsertUser): Promise<User> {
    return this.upsertUser({ ...user, id: randomUUID() });
  }

  async completeOnboarding(userId: string): Promise<User> {
    try {
      const userRef = this.db.collection('users').doc(userId);
      await userRef.update({
        hasCompletedOnboarding: true,
        updatedAt: new Date()
      });
      
      const doc = await userRef.get();
      return { id: doc.id, ...doc.data() } as User;
    } catch (error) {
      console.error('Error completing onboarding:', error);
      throw error;
    }
  }

  // Banter methods
  async getBanterItem(id: string): Promise<BanterItem | undefined> {
    try {
      const doc = await this.db.collection('banterItems').doc(id).get();
      if (doc.exists) {
        return { id: doc.id, ...doc.data() } as BanterItem;
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
      
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as BanterItem);
    } catch (error) {
      console.error('Error getting banters by user:', error);
      return [];
    }
  }

  async searchBanters(userId: string, query: string, eventType: string, limit: number = 50): Promise<BanterItem[]> {
    try {
      let ref = this.db.collection('banterItems').where('userId', '==', userId);
      
      if (eventType && eventType !== 'all') {
        ref = ref.where('eventType', '==', eventType);
      }
      
      const snapshot = await ref
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();
      
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as BanterItem);
      
      // Client-side search since Firestore doesn't support full-text search
      if (query) {
        const lowerQuery = query.toLowerCase();
        return results.filter(banter => 
          banter.banterText?.toLowerCase().includes(lowerQuery) ||
          banter.originalMessage?.toLowerCase().includes(lowerQuery)
        );
      }
      
      return results;
    } catch (error) {
      console.error('Error searching banters:', error);
      return [];
    }
  }

  async createBanterItem(banter: InsertBanterItem): Promise<BanterItem> {
    try {
      const banterId = randomUUID();
      const banterData = {
        ...banter,
        id: banterId,
        createdAt: new Date()
      };

      await this.db.collection('banterItems').doc(banterId).set(banterData);
      return banterData as BanterItem;
    } catch (error) {
      console.error('Error creating banter item:', error);
      throw error;
    }
  }

  async updateBanterItem(id: string, updates: Partial<BanterItem>): Promise<BanterItem | undefined> {
    try {
      const ref = this.db.collection('banterItems').doc(id);
      await ref.update(updates);
      
      const doc = await ref.get();
      if (doc.exists) {
        return { id: doc.id, ...doc.data() } as BanterItem;
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
      const snapshot = await this.db.collection('userSettings')
        .where('userId', '==', userId)
        .limit(1)
        .get();
      
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() } as UserSettings;
      }
      return undefined;
    } catch (error) {
      console.error('Error getting user settings:', error);
      return undefined;
    }
  }

  async createUserSettings(settings: InsertUserSettings): Promise<UserSettings> {
    try {
      const settingsId = randomUUID();
      const settingsData = {
        ...settings,
        id: settingsId,
        updatedAt: new Date()
      };

      await this.db.collection('userSettings').doc(settingsId).set(settingsData);
      return settingsData as UserSettings;
    } catch (error) {
      console.error('Error creating user settings:', error);
      throw error;
    }
  }

  async updateUserSettings(userId: string, updates: Partial<UserSettings>): Promise<UserSettings | undefined> {
    try {
      const snapshot = await this.db.collection('userSettings')
        .where('userId', '==', userId)
        .limit(1)
        .get();
      
      if (snapshot.empty) {
        return undefined;
      }

      const doc = snapshot.docs[0];
      const ref = this.db.collection('userSettings').doc(doc.id);
      
      await ref.update({
        ...updates,
        updatedAt: new Date()
      });
      
      const updatedDoc = await ref.get();
      return { id: updatedDoc.id, ...updatedDoc.data() } as UserSettings;
    } catch (error) {
      console.error('Error updating user settings:', error);
      return undefined;
    }
  }

  // Stats methods
  async getDailyStats(userId: string, date: string): Promise<DailyStats | undefined> {
    try {
      const snapshot = await this.db.collection('dailyStats')
        .where('userId', '==', userId)
        .where('date', '==', date)
        .limit(1)
        .get();
      
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() } as DailyStats;
      }
      return undefined;
    } catch (error) {
      console.error('Error getting daily stats:', error);
      return undefined;
    }
  }

  async createDailyStats(stats: InsertDailyStats): Promise<DailyStats> {
    try {
      const statsId = randomUUID();
      const statsData = {
        ...stats,
        id: statsId
      };

      await this.db.collection('dailyStats').doc(statsId).set(statsData);
      return statsData as DailyStats;
    } catch (error) {
      console.error('Error creating daily stats:', error);
      throw error;
    }
  }

  async updateDailyStats(userId: string, date: string, updates: Partial<DailyStats>): Promise<DailyStats | undefined> {
    try {
      const snapshot = await this.db.collection('dailyStats')
        .where('userId', '==', userId)
        .where('date', '==', date)
        .limit(1)
        .get();
      
      if (snapshot.empty) {
        return undefined;
      }

      const doc = snapshot.docs[0];
      const ref = this.db.collection('dailyStats').doc(doc.id);
      
      await ref.update(updates);
      
      const updatedDoc = await ref.get();
      return { id: updatedDoc.id, ...updatedDoc.data() } as DailyStats;
    } catch (error) {
      console.error('Error updating daily stats:', error);
      return undefined;
    }
  }

  async checkAndIncrementDailyUsage(userId: string): Promise<{ allowed: boolean; current: number; limit: number; isPro: boolean }> {
    try {
      const user = await this.getUser(userId);
      const isPro = user?.subscriptionTier === 'pro';
      const limit = isPro ? 1000 : 50; // Pro users get 1000, free users get 50
      
      const today = new Date().toISOString().split('T')[0];
      const stats = await this.getDailyStats(userId, today);
      
      const current = stats?.bantersGenerated || 0;
      const allowed = current < limit;
      
      if (allowed) {
        await this.updateDailyStats(userId, today, {
          bantersGenerated: current + 1
        });
      }
      
      return { allowed, current: current + 1, limit, isPro };
    } catch (error) {
      console.error('Error checking daily usage:', error);
      return { allowed: false, current: 0, limit: 0, isPro: false };
    }
  }

  // Twitch methods
  async getTwitchSettings(userId: string): Promise<TwitchSettings | undefined> {
    try {
      const snapshot = await this.db.collection('twitchSettings')
        .where('userId', '==', userId)
        .limit(1)
        .get();
      
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() } as TwitchSettings;
      }
      return undefined;
    } catch (error) {
      console.error('Error getting Twitch settings:', error);
      return undefined;
    }
  }

  async upsertTwitchSettings(settings: InsertTwitchSettings): Promise<TwitchSettings> {
    try {
      const snapshot = await this.db.collection('twitchSettings')
        .where('userId', '==', settings.userId)
        .limit(1)
        .get();
      
      const settingsData = {
        ...settings,
        updatedAt: new Date()
      };

      if (snapshot.empty) {
        // Create new
        const settingsId = randomUUID();
        settingsData.id = settingsId;
        settingsData.createdAt = new Date();
        await this.db.collection('twitchSettings').doc(settingsId).set(settingsData);
      } else {
        // Update existing
        const doc = snapshot.docs[0];
        await this.db.collection('twitchSettings').doc(doc.id).update(settingsData);
        settingsData.id = doc.id;
      }

      return settingsData as TwitchSettings;
    } catch (error) {
      console.error('Error upserting Twitch settings:', error);
      throw error;
    }
  }

  async updateTwitchEventSettings(userId: string, enabledEvents: string[]): Promise<TwitchSettings | undefined> {
    try {
      const snapshot = await this.db.collection('twitchSettings')
        .where('userId', '==', userId)
        .limit(1)
        .get();
      
      if (snapshot.empty) {
        return undefined;
      }

      const doc = snapshot.docs[0];
      const ref = this.db.collection('twitchSettings').doc(doc.id);
      
      await ref.update({
        enabledEvents,
        updatedAt: new Date()
      });
      
      const updatedDoc = await ref.get();
      return { id: updatedDoc.id, ...updatedDoc.data() } as TwitchSettings;
    } catch (error) {
      console.error('Error updating Twitch event settings:', error);
      return undefined;
    }
  }

  // Discord methods (legacy)
  async getDiscordSettings(userId: string): Promise<DiscordSettings | undefined> {
    try {
      const snapshot = await this.db.collection('discordSettings')
        .where('userId', '==', userId)
        .limit(1)
        .get();
      
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() } as DiscordSettings;
      }
      return undefined;
    } catch (error) {
      console.error('Error getting Discord settings:', error);
      return undefined;
    }
  }

  async upsertDiscordSettings(settings: InsertDiscordSettings): Promise<DiscordSettings> {
    try {
      const snapshot = await this.db.collection('discordSettings')
        .where('userId', '==', settings.userId)
        .limit(1)
        .get();
      
      const settingsData = {
        ...settings,
        updatedAt: new Date()
      };

      if (snapshot.empty) {
        // Create new
        const settingsId = randomUUID();
        settingsData.id = settingsId;
        settingsData.createdAt = new Date();
        await this.db.collection('discordSettings').doc(settingsId).set(settingsData);
      } else {
        // Update existing
        const doc = snapshot.docs[0];
        await this.db.collection('discordSettings').doc(doc.id).update(settingsData);
        settingsData.id = doc.id;
      }

      return settingsData as DiscordSettings;
    } catch (error) {
      console.error('Error upserting Discord settings:', error);
      throw error;
    }
  }

  async updateDiscordEventSettings(userId: string, enabledEvents: string[]): Promise<DiscordSettings | undefined> {
    try {
      const snapshot = await this.db.collection('discordSettings')
        .where('userId', '==', userId)
        .limit(1)
        .get();
      
      if (snapshot.empty) {
        return undefined;
      }

      const doc = snapshot.docs[0];
      const ref = this.db.collection('discordSettings').doc(doc.id);
      
      await ref.update({
        enabledEvents,
        updatedAt: new Date()
      });
      
      const updatedDoc = await ref.get();
      return { id: updatedDoc.id, ...updatedDoc.data() } as DiscordSettings;
    } catch (error) {
      console.error('Error updating Discord event settings:', error);
      return undefined;
    }
  }

  // Discord Bot methods (new)
  async getLinkCode(code: string): Promise<LinkCode | undefined> {
    try {
      const snapshot = await this.db.collection('linkCodes')
        .where('code', '==', code)
        .limit(1)
        .get();
      
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() } as LinkCode;
      }
      return undefined;
    } catch (error) {
      console.error('Error getting link code:', error);
      return undefined;
    }
  }

  async createLinkCode(linkCode: InsertLinkCode): Promise<LinkCode> {
    try {
      const linkCodeId = randomUUID();
      const linkCodeData = {
        ...linkCode,
        id: linkCodeId,
        createdAt: new Date()
      };

      await this.db.collection('linkCodes').doc(linkCodeId).set(linkCodeData);
      return linkCodeData as LinkCode;
    } catch (error) {
      console.error('Error creating link code:', error);
      throw error;
    }
  }

  async consumeLinkCode(code: string): Promise<void> {
    try {
      const snapshot = await this.db.collection('linkCodes')
        .where('code', '==', code)
        .limit(1)
        .get();
      
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        await this.db.collection('linkCodes').doc(doc.id).update({
          consumedAt: new Date()
        });
      }
    } catch (error) {
      console.error('Error consuming link code:', error);
      throw error;
    }
  }

  async getGuildLink(guildId: string): Promise<GuildLink | undefined> {
    try {
      const snapshot = await this.db.collection('guildLinks')
        .where('guildId', '==', guildId)
        .limit(1)
        .get();
      
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() } as GuildLink;
      }
      return undefined;
    } catch (error) {
      console.error('Error getting guild link:', error);
      return undefined;
    }
  }

  async createGuildLink(guildLink: InsertGuildLink): Promise<GuildLink> {
    try {
      const guildLinkId = randomUUID();
      const guildLinkData = {
        ...guildLink,
        id: guildLinkId,
        createdAt: new Date()
      };

      await this.db.collection('guildLinks').doc(guildLinkId).set(guildLinkData);
      return guildLinkData as GuildLink;
    } catch (error) {
      console.error('Error creating guild link:', error);
      throw error;
    }
  }

  async deactivateGuildLink(guildId: string): Promise<void> {
    try {
      const snapshot = await this.db.collection('guildLinks')
        .where('guildId', '==', guildId)
        .limit(1)
        .get();
      
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        await this.db.collection('guildLinks').doc(doc.id).update({
          active: false
        });
      }
    } catch (error) {
      console.error('Error deactivating guild link:', error);
      throw error;
    }
  }

  async getAllActiveGuildLinks(): Promise<GuildLink[]> {
    try {
      const snapshot = await this.db.collection('guildLinks')
        .where('active', '==', true)
        .get();
      
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as GuildLink);
    } catch (error) {
      console.error('Error getting all active guild links:', error);
      return [];
    }
  }

  async getGuildSettings(guildId: string): Promise<GuildSettings | undefined> {
    try {
      const doc = await this.db.collection('guildSettings').doc(guildId).get();
      if (doc.exists) {
        return { guildId: doc.id, ...doc.data() } as GuildSettings;
      }
      return undefined;
    } catch (error) {
      console.error('Error getting guild settings:', error);
      return undefined;
    }
  }

  async upsertGuildSettings(settings: InsertGuildSettings): Promise<GuildSettings> {
    try {
      const settingsData = {
        ...settings,
        updatedAt: new Date()
      };

      await this.db.collection('guildSettings').doc(settings.guildId).set(settingsData, { merge: true });
      return settingsData as GuildSettings;
    } catch (error) {
      console.error('Error upserting guild settings:', error);
      throw error;
    }
  }

  // Billing and API Key methods
  async saveUserApiKey(keyData: { userId: string; provider: string; apiKey: string; isActive?: boolean }): Promise<void> {
    try {
      const apiKeyId = randomUUID();
      const apiKeyData = {
        id: apiKeyId,
        userId: keyData.userId,
        provider: keyData.provider,
        apiKey: keyData.apiKey,
        isActive: keyData.isActive ?? true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.db.collection('userApiKeys').doc(apiKeyId).set(apiKeyData);
    } catch (error) {
      console.error('Error saving user API key:', error);
      throw error;
    }
  }

  async getUserApiKeys(userId: string): Promise<any[]> {
    try {
      const snapshot = await this.db.collection('userApiKeys')
        .where('userId', '==', userId)
        .get();
      
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
      throw error;
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
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() };
      }
      return null;
    } catch (error) {
      console.error('Error getting usage tracking:', error);
      return null;
    }
  }

  async updateUsageTracking(userId: string, updates: any): Promise<void> {
    try {
      const snapshot = await this.db.collection('usageTracking')
        .where('userId', '==', userId)
        .where('date', '==', updates.date)
        .limit(1)
        .get();
      
      if (snapshot.empty) {
        // Create new
        const usageId = randomUUID();
        const usageData = {
          id: usageId,
          userId,
          ...updates,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        await this.db.collection('usageTracking').doc(usageId).set(usageData);
      } else {
        // Update existing
        const doc = snapshot.docs[0];
        await this.db.collection('usageTracking').doc(doc.id).update({
          ...updates,
          updatedAt: new Date()
        });
      }
    } catch (error) {
      console.error('Error updating usage tracking:', error);
      throw error;
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
      await this.upsertGuildSettings({
        guildId,
        workspaceId: '', // This will be set by the calling code
        currentStreamer: userId
      });
    } catch (error) {
      console.error('Error setting current streamer:', error);
      throw error;
    }
  }

  async clearCurrentStreamer(guildId: string): Promise<void> {
    try {
      const settings = await this.getGuildSettings(guildId);
      if (settings) {
        await this.upsertGuildSettings({
          ...settings,
          currentStreamer: null
        });
      }
    } catch (error) {
      console.error('Error clearing current streamer:', error);
      throw error;
    }
  }

  // Context memory methods
  async createContextMemory(context: InsertContextMemory): Promise<ContextMemory> {
    try {
      const contextId = randomUUID();
      const contextData = {
        ...context,
        id: contextId,
        createdAt: new Date()
      };

      await this.db.collection('contextMemory').doc(contextId).set(contextData);
      return contextData as ContextMemory;
    } catch (error) {
      console.error('Error creating context memory:', error);
      throw error;
    }
  }

  async getRecentContext(userId: string, guildId?: string, limit: number = 50): Promise<ContextMemory[]> {
    try {
      let ref = this.db.collection('contextMemory')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(limit);
      
      if (guildId) {
        ref = ref.where('guildId', '==', guildId);
      }
      
      const snapshot = await ref.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as ContextMemory);
    } catch (error) {
      console.error('Error getting recent context:', error);
      return [];
    }
  }

  async getContextByType(userId: string, eventType: string, guildId?: string, limit: number = 50): Promise<ContextMemory[]> {
    try {
      let ref = this.db.collection('contextMemory')
        .where('userId', '==', userId)
        .where('eventType', '==', eventType)
        .orderBy('createdAt', 'desc')
        .limit(limit);
      
      if (guildId) {
        ref = ref.where('guildId', '==', guildId);
      }
      
      const snapshot = await ref.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as ContextMemory);
    } catch (error) {
      console.error('Error getting context by type:', error);
      return [];
    }
  }

  async updateContextResponse(contextId: string, banterResponse: string): Promise<void> {
    try {
      await this.db.collection('contextMemory').doc(contextId).update({
        banterResponse,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating context response:', error);
      throw error;
    }
  }

  async cleanExpiredContext(): Promise<number> {
    try {
      const now = new Date();
      const snapshot = await this.db.collection('contextMemory')
        .where('expiresAt', '<', now)
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
    try {
      const voiceId = randomUUID();
      const voiceData = {
        ...voice,
        id: voiceId,
        createdAt: new Date(),
        updatedAt: new Date(),
        downloads: 0,
        upvotes: 0,
        downvotes: 0,
        isActive: true,
        isVerified: false,
        moderationStatus: 'pending'
      };

      await this.db.collection('marketplaceVoices').doc(voiceId).set(voiceData);
      return voiceData as MarketplaceVoice;
    } catch (error) {
      console.error('Error creating marketplace voice:', error);
      throw error;
    }
  }

  async createMarketplacePersonality(personality: InsertMarketplacePersonality): Promise<MarketplacePersonality> {
    try {
      const personalityId = randomUUID();
      const personalityData = {
        ...personality,
        id: personalityId,
        createdAt: new Date(),
        updatedAt: new Date(),
        downloads: 0,
        upvotes: 0,
        downvotes: 0,
        isActive: true,
        isVerified: false,
        moderationStatus: 'pending'
      };

      await this.db.collection('marketplacePersonalities').doc(personalityId).set(personalityData);
      return personalityData as MarketplacePersonality;
    } catch (error) {
      console.error('Error creating marketplace personality:', error);
      throw error;
    }
  }

  async getMarketplaceVoices(filters?: { category?: string; search?: string; sortBy?: string; limit?: number }): Promise<MarketplaceVoice[]> {
    try {
      let ref = this.db.collection('marketplaceVoices').where('isActive', '==', true);
      
      if (filters?.category) {
        ref = ref.where('category', '==', filters.category);
      }
      
      if (filters?.sortBy === 'downloads') {
        ref = ref.orderBy('downloads', 'desc');
      } else if (filters?.sortBy === 'created') {
        ref = ref.orderBy('createdAt', 'desc');
      } else {
        ref = ref.orderBy('upvotes', 'desc');
      }
      
      if (filters?.limit) {
        ref = ref.limit(filters.limit);
      }
      
      const snapshot = await ref.get();
      let results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as MarketplaceVoice);
      
      // Client-side search
      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        results = results.filter(voice => 
          voice.name.toLowerCase().includes(searchLower) ||
          voice.description?.toLowerCase().includes(searchLower) ||
          voice.tags?.some(tag => tag.toLowerCase().includes(searchLower))
        );
      }
      
      return results;
    } catch (error) {
      console.error('Error getting marketplace voices:', error);
      return [];
    }
  }

  async getMarketplacePersonalities(filters?: { category?: string; search?: string; sortBy?: string; limit?: number }): Promise<MarketplacePersonality[]> {
    try {
      let ref = this.db.collection('marketplacePersonalities').where('isActive', '==', true);
      
      if (filters?.category) {
        ref = ref.where('category', '==', filters.category);
      }
      
      if (filters?.sortBy === 'downloads') {
        ref = ref.orderBy('downloads', 'desc');
      } else if (filters?.sortBy === 'created') {
        ref = ref.orderBy('createdAt', 'desc');
      } else {
        ref = ref.orderBy('upvotes', 'desc');
      }
      
      if (filters?.limit) {
        ref = ref.limit(filters.limit);
      }
      
      const snapshot = await ref.get();
      let results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as MarketplacePersonality);
      
      // Client-side search
      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        results = results.filter(personality => 
          personality.name.toLowerCase().includes(searchLower) ||
          personality.description?.toLowerCase().includes(searchLower) ||
          personality.tags?.some(tag => tag.toLowerCase().includes(searchLower))
        );
      }
      
      return results;
    } catch (error) {
      console.error('Error getting marketplace personalities:', error);
      return [];
    }
  }

  async getMarketplaceVoice(id: string): Promise<MarketplaceVoice | undefined> {
    try {
      const doc = await this.db.collection('marketplaceVoices').doc(id).get();
      if (doc.exists) {
        return { id: doc.id, ...doc.data() } as MarketplaceVoice;
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
        return { id: doc.id, ...doc.data() } as MarketplacePersonality;
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
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating marketplace item:', error);
      throw error;
    }
  }

  // User interactions
  async downloadMarketplaceItem(userId: string, itemType: 'voice' | 'personality', itemId: string): Promise<UserDownload> {
    try {
      const downloadId = randomUUID();
      const downloadData = {
        id: downloadId,
        userId,
        itemType,
        itemId,
        downloadedAt: new Date()
      };

      await this.db.collection('userDownloads').doc(downloadId).set(downloadData);
      
      // Increment download count
      const collection = itemType === 'voice' ? 'marketplaceVoices' : 'marketplacePersonalities';
      const itemRef = this.db.collection(collection).doc(itemId);
      await itemRef.update({
        downloads: admin.firestore.FieldValue.increment(1)
      });
      
      return downloadData as UserDownload;
    } catch (error) {
      console.error('Error downloading marketplace item:', error);
      throw error;
    }
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
      console.error('Error checking if user downloaded:', error);
      return false;
    }
  }

  async rateMarketplaceItem(userId: string, itemType: 'voice' | 'personality', itemId: string, rating: 1 | -1): Promise<void> {
    try {
      // Check if user already rated
      const snapshot = await this.db.collection('userRatings')
        .where('userId', '==', userId)
        .where('itemType', '==', itemType)
        .where('itemId', '==', itemId)
        .limit(1)
        .get();
      
      const collection = itemType === 'voice' ? 'marketplaceVoices' : 'marketplacePersonalities';
      const itemRef = this.db.collection(collection).doc(itemId);
      
      if (snapshot.empty) {
        // Create new rating
        const ratingId = randomUUID();
        const ratingData = {
          id: ratingId,
          userId,
          itemType,
          itemId,
          rating,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        await this.db.collection('userRatings').doc(ratingId).set(ratingData);
        
        // Update item stats
        if (rating === 1) {
          await itemRef.update({
            upvotes: admin.firestore.FieldValue.increment(1)
          });
        } else {
          await itemRef.update({
            downvotes: admin.firestore.FieldValue.increment(1)
          });
        }
      } else {
        // Update existing rating
        const doc = snapshot.docs[0];
        const oldRating = doc.data().rating;
        
        await this.db.collection('userRatings').doc(doc.id).update({
          rating,
          updatedAt: new Date()
        });
        
        // Update item stats
        if (oldRating !== rating) {
          if (rating === 1) {
            await itemRef.update({
              upvotes: admin.firestore.FieldValue.increment(1),
              downvotes: admin.firestore.FieldValue.increment(-1)
            });
          } else {
            await itemRef.update({
              upvotes: admin.firestore.FieldValue.increment(-1),
              downvotes: admin.firestore.FieldValue.increment(1)
            });
          }
        }
      }
    } catch (error) {
      console.error('Error rating marketplace item:', error);
      throw error;
    }
  }

  async getUserRating(userId: string, itemType: 'voice' | 'personality', itemId: string): Promise<number | null> {
    try {
      const snapshot = await this.db.collection('userRatings')
        .where('userId', '==', userId)
        .where('itemType', '==', itemType)
        .where('itemId', '==', itemId)
        .limit(1)
        .get();
      
      if (!snapshot.empty) {
        return snapshot.docs[0].data().rating;
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
        moderatedBy: moderatorId
      });
    } catch (error) {
      console.error('Error moderating marketplace item:', error);
      throw error;
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
      
      const voices = voicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as MarketplaceVoice);
      const personalities = personalitiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as MarketplacePersonality);
      
      return { voices, personalities };
    } catch (error) {
      console.error('Error getting pending moderation items:', error);
      return { voices: [], personalities: [] };
    }
  }

  // Reporting
  async reportContent(report: InsertContentReport): Promise<ContentReport> {
    try {
      const reportId = randomUUID();
      const reportData = {
        ...report,
        id: reportId,
        status: 'pending',
        createdAt: new Date()
      };

      await this.db.collection('contentReports').doc(reportId).set(reportData);
      return reportData as ContentReport;
    } catch (error) {
      console.error('Error reporting content:', error);
      throw error;
    }
  }

  async getContentReports(status?: string): Promise<ContentReport[]> {
    try {
      let ref = this.db.collection('contentReports');
      
      if (status) {
        ref = ref.where('status', '==', status);
      }
      
      const snapshot = await ref.orderBy('createdAt', 'desc').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as ContentReport);
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
        reviewedAt: new Date()
      });
    } catch (error) {
      console.error('Error reviewing report:', error);
      throw error;
    }
  }
}

// Import the interface from storage.ts
import type { IStorage } from './storage';
import admin from 'firebase-admin';