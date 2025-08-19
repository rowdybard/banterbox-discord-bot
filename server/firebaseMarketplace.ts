import { getFirestoreDb } from './firebase';
import { randomUUID } from 'node:crypto';
import * as admin from 'firebase-admin';

export interface MarketplaceVoice {
  id: string;
  name: string;
  description?: string;
  category: string;
  tags: string[];
  voiceId: string;
  baseVoiceId?: string;
  settings: any;
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

export interface MarketplacePersonality {
  id: string;
  name: string;
  description?: string;
  prompt: string;
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

export interface UserDownload {
  id: string;
  userId: string;
  itemType: 'voice' | 'personality';
  itemId: string;
  downloadedAt: Date;
}

export interface UserRating {
  id: string;
  userId: string;
  itemType: 'voice' | 'personality';
  itemId: string;
  rating: number; // 1 for upvote, -1 for downvote
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentReport {
  id: string;
  reporterId: string;
  itemType: 'voice' | 'personality';
  itemId: string;
  reason: string;
  description?: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  reviewedBy?: string;
  reviewNotes?: string;
  createdAt: Date;
  reviewedAt?: Date;
}

export class FirebaseMarketplaceService {
  private db: any;

  constructor() {
    this.db = getFirestoreDb();
  }

  // Create a new marketplace voice
  async createVoice(voice: Omit<MarketplaceVoice, 'id' | 'createdAt' | 'updatedAt'>): Promise<MarketplaceVoice> {
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
      isVerified: false,
      isActive: true,
      moderationStatus: 'approved'
    };

    await this.db.collection('marketplace_voices').doc(id).set(newVoice);
    return newVoice;
  }

  // Create a new marketplace personality
  async createPersonality(personality: Omit<MarketplacePersonality, 'id' | 'createdAt' | 'updatedAt'>): Promise<MarketplacePersonality> {
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
      isVerified: false,
      isActive: true,
      moderationStatus: 'approved'
    };

    await this.db.collection('marketplace_personalities').doc(id).set(newPersonality);
    return newPersonality;
  }

  // Get marketplace voices with filters
  async getVoices(filters?: {
    category?: string;
    search?: string;
    sortBy?: string;
    limit?: number;
    onlyApproved?: boolean;
  }): Promise<MarketplaceVoice[]> {
    let query = this.db.collection('marketplace_voices');

    // Apply filters
    if (filters?.onlyApproved !== false) {
      query = query.where('isActive', '==', true).where('moderationStatus', '==', 'approved');
    }

    if (filters?.category && filters.category !== 'all') {
      query = query.where('category', '==', filters.category);
    }

    // Apply limit
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    // Apply sorting
    switch (filters?.sortBy) {
      case 'newest':
        query = query.orderBy('createdAt', 'desc');
        break;
      case 'downloads':
        query = query.orderBy('downloads', 'desc');
        break;
      case 'rating':
        // Note: Firestore doesn't support complex expressions, so we'll sort by upvotes for now
        query = query.orderBy('upvotes', 'desc');
        break;
      default:
        // Popular: sort by downloads
        query = query.orderBy('downloads', 'desc');
    }

    const snapshot = await query.get();
    let voices: MarketplaceVoice[] = [];

    snapshot.forEach((doc: any) => {
      const data = doc.data();
      voices.push({
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        moderatedAt: data.moderatedAt?.toDate(),
      });
    });

    // Apply search filter in memory (Firestore doesn't support full-text search)
    if (filters?.search) {
      const searchTerm = filters.search.toLowerCase();
      voices = voices.filter(voice => 
        voice.name.toLowerCase().includes(searchTerm) ||
        voice.description?.toLowerCase().includes(searchTerm)
      );
    }

    return voices;
  }

  // Get marketplace personalities with filters
  async getPersonalities(filters?: {
    category?: string;
    search?: string;
    sortBy?: string;
    limit?: number;
    onlyApproved?: boolean;
  }): Promise<MarketplacePersonality[]> {
    let query = this.db.collection('marketplace_personalities');

    // Apply filters
    if (filters?.onlyApproved !== false) {
      query = query.where('isActive', '==', true).where('moderationStatus', '==', 'approved');
    }

    if (filters?.category && filters.category !== 'all') {
      query = query.where('category', '==', filters.category);
    }

    // Apply limit
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    // Apply sorting
    switch (filters?.sortBy) {
      case 'newest':
        query = query.orderBy('createdAt', 'desc');
        break;
      case 'downloads':
        query = query.orderBy('downloads', 'desc');
        break;
      case 'rating':
        query = query.orderBy('upvotes', 'desc');
        break;
      default:
        query = query.orderBy('downloads', 'desc');
    }

    const snapshot = await query.get();
    let personalities: MarketplacePersonality[] = [];

    snapshot.forEach((doc: any) => {
      const data = doc.data();
      personalities.push({
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        moderatedAt: data.moderatedAt?.toDate(),
      });
    });

    // Apply search filter in memory
    if (filters?.search) {
      const searchTerm = filters.search.toLowerCase();
      personalities = personalities.filter(personality => 
        personality.name.toLowerCase().includes(searchTerm) ||
        personality.description?.toLowerCase().includes(searchTerm)
      );
    }

    return personalities;
  }

  // Get a specific voice by ID
  async getVoice(id: string): Promise<MarketplaceVoice | null> {
    const doc = await this.db.collection('marketplace_voices').doc(id).get();
    if (!doc.exists) return null;
    
    const data = doc.data();
    return {
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      moderatedAt: data.moderatedAt?.toDate(),
    };
  }

  // Get a specific personality by ID
  async getPersonality(id: string): Promise<MarketplacePersonality | null> {
    const doc = await this.db.collection('marketplace_personalities').doc(id).get();
    if (!doc.exists) return null;
    
    const data = doc.data();
    return {
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      moderatedAt: data.moderatedAt?.toDate(),
    };
  }

  // Track download
  async downloadItem(userId: string, itemType: 'voice' | 'personality', itemId: string): Promise<void> {
    const downloadId = randomUUID();
    const download: UserDownload = {
      id: downloadId,
      userId,
      itemType,
      itemId,
      downloadedAt: new Date()
    };

    await this.db.collection('user_downloads').doc(downloadId).set(download);

    // Increment download count
    const collection = itemType === 'voice' ? 'marketplace_voices' : 'marketplace_personalities';
    const docRef = this.db.collection(collection).doc(itemId);
    await docRef.update({
      downloads: admin.firestore.FieldValue.increment(1)
    });
  }

  // Check if user has downloaded an item
  async hasUserDownloaded(userId: string, itemType: 'voice' | 'personality', itemId: string): Promise<boolean> {
    const snapshot = await this.db.collection('user_downloads')
      .where('userId', '==', userId)
      .where('itemType', '==', itemType)
      .where('itemId', '==', itemId)
      .limit(1)
      .get();

    return !snapshot.empty;
  }

  // Rate an item
  async rateItem(userId: string, itemType: 'voice' | 'personality', itemId: string, rating: number): Promise<void> {
    const ratingId = `${userId}_${itemType}_${itemId}`;
    const now = new Date();

    const userRating: UserRating = {
      id: ratingId,
      userId,
      itemType,
      itemId,
      rating,
      createdAt: now,
      updatedAt: now
    };

    await this.db.collection('user_ratings').doc(ratingId).set(userRating);

    // Update item rating counts
    const collection = itemType === 'voice' ? 'marketplace_voices' : 'marketplace_personalities';
    const docRef = this.db.collection(collection).doc(itemId);
    
    if (rating === 1) {
      await docRef.update({
        upvotes: admin.firestore.FieldValue.increment(1)
      });
    } else if (rating === -1) {
      await docRef.update({
        downvotes: admin.firestore.FieldValue.increment(1)
      });
    }
  }

  // Get user's rating for an item
  async getUserRating(userId: string, itemType: 'voice' | 'personality', itemId: string): Promise<number | null> {
    const ratingId = `${userId}_${itemType}_${itemId}`;
    const doc = await this.db.collection('user_ratings').doc(ratingId).get();
    
    if (!doc.exists) return null;
    return doc.data().rating;
  }

  // Report content
  async reportContent(report: Omit<ContentReport, 'id' | 'createdAt'>): Promise<ContentReport> {
    const id = randomUUID();
    const now = new Date();
    
    const newReport: ContentReport = {
      ...report,
      id,
      createdAt: now
    };

    await this.db.collection('content_reports').doc(id).set(newReport);
    return newReport;
  }

  // Get user's marketplace items
  async getUserMarketplaceItems(userId: string): Promise<{ voices: MarketplaceVoice[], personalities: MarketplacePersonality[] }> {
    const [voicesSnapshot, personalitiesSnapshot] = await Promise.all([
      this.db.collection('marketplace_voices').where('authorId', '==', userId).get(),
      this.db.collection('marketplace_personalities').where('authorId', '==', userId).get()
    ]);

    const voices: MarketplaceVoice[] = [];
    const personalities: MarketplacePersonality[] = [];

    voicesSnapshot.forEach((doc: any) => {
      const data = doc.data();
      voices.push({
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        moderatedAt: data.moderatedAt?.toDate(),
      });
    });

    personalitiesSnapshot.forEach((doc: any) => {
      const data = doc.data();
      personalities.push({
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        moderatedAt: data.moderatedAt?.toDate(),
      });
    });

    return { voices, personalities };
  }
}

// Export singleton instance
export const firebaseMarketplaceService = new FirebaseMarketplaceService();
