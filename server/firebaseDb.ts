import { getFirestoreDb } from './firebase';
import type { UserSettings, BanterItem } from '@shared/schema';

// Firebase-based database service
export class FirebaseDatabaseService {
  private db: any;

  constructor() {
    this.db = getFirestoreDb();
  }

  isAvailable(): boolean {
    return !!this.db;
  }

  // User Settings
  async getUserSettings(userId: string): Promise<UserSettings | null> {
    if (!this.db) {
      console.log('Firebase not available, returning null for user settings');
      return null;
    }

    try {
      const doc = await this.db.collection('users').doc(userId).get();
      if (doc.exists) {
        return doc.data() as UserSettings;
      }
      return null;
    } catch (error) {
      console.error('Error getting user settings from Firebase:', error);
      return null;
    }
  }

  async updateUserSettings(userId: string, settings: Partial<UserSettings>): Promise<boolean> {
    if (!this.db) {
      console.log('Firebase not available, cannot update user settings');
      return false;
    }

    try {
      await this.db.collection('users').doc(userId).set(settings, { merge: true });
      return true;
    } catch (error) {
      console.error('Error updating user settings in Firebase:', error);
      return false;
    }
  }

  // Banter Items
  async getBantersByUser(userId: string, limit: number = 50): Promise<BanterItem[]> {
    if (!this.db) {
      console.log('Firebase not available, returning empty banter list');
      return [];
    }

    try {
      const snapshot = await this.db
        .collection('banterItems')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => doc.data() as BanterItem);
    } catch (error) {
      console.error('Error getting banter items from Firebase:', error);
      return [];
    }
  }

  async createBanterItem(banterItem: Omit<BanterItem, 'id'>): Promise<BanterItem | null> {
    if (!this.db) {
      console.log('Firebase not available, cannot create banter item');
      return null;
    }

    try {
      const docRef = this.db.collection('banterItems').doc();
      const banterWithId = {
        ...banterItem,
        id: docRef.id,
        createdAt: new Date().toISOString()
      };
      
      await docRef.set(banterWithId);
      return banterWithId as BanterItem;
    } catch (error) {
      console.error('Error creating banter item in Firebase:', error);
      return null;
    }
  }

  // Users
  async getUser(userId: string): Promise<any | null> {
    if (!this.db) {
      console.log('Firebase not available, returning null for user');
      return null;
    }

    try {
      const doc = await this.db.collection('users').doc(userId).get();
      if (doc.exists) {
        return doc.data();
      }
      return null;
    } catch (error) {
      console.error('Error getting user from Firebase:', error);
      return null;
    }
  }

  async createUser(userId: string, userData: any): Promise<boolean> {
    if (!this.db) {
      console.log('Firebase not available, cannot create user');
      return false;
    }

    try {
      await this.db.collection('users').doc(userId).set(userData);
      return true;
    } catch (error) {
      console.error('Error creating user in Firebase:', error);
      return false;
    }
  }

  async updateUser(userId: string, userData: any): Promise<boolean> {
    if (!this.db) {
      console.log('Firebase not available, cannot update user');
      return false;
    }

    try {
      await this.db.collection('users').doc(userId).update(userData);
      return true;
    } catch (error) {
      console.error('Error updating user in Firebase:', error);
      return false;
    }
  }

  // Guild Links
  async getGuildLinks(guildId: string): Promise<any | null> {
    if (!this.db) {
      console.log('Firebase not available, returning null for guild links');
      return null;
    }

    try {
      const doc = await this.db.collection('guildLinks').doc(guildId).get();
      if (doc.exists) {
        return doc.data();
      }
      return null;
    } catch (error) {
      console.error('Error getting guild links from Firebase:', error);
      return null;
    }
  }

  async createGuildLink(guildId: string, linkData: any): Promise<boolean> {
    if (!this.db) {
      console.log('Firebase not available, cannot create guild link');
      return false;
    }

    try {
      await this.db.collection('guildLinks').doc(guildId).set(linkData);
      return true;
    } catch (error) {
      console.error('Error creating guild link in Firebase:', error);
      return false;
    }
  }

  async updateGuildLink(guildId: string, linkData: any): Promise<boolean> {
    if (!this.db) {
      console.log('Firebase not available, cannot update guild link');
      return false;
    }

    try {
      await this.db.collection('guildLinks').doc(guildId).update(linkData);
      return true;
    } catch (error) {
      console.error('Error updating guild link in Firebase:', error);
      return false;
    }
  }
}

// Export singleton instance
export const firebaseDb = new FirebaseDatabaseService();
