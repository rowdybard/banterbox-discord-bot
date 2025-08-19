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
    try {
      this.db = getFirestoreDb();
    } catch (error) {
      console.error('Failed to initialize Firebase marketplace service:', error);
      this.db = null;
    }
  }

  private isAvailable(): boolean {
    return !!this.db;
  }

  // Create a new marketplace voice
  async createVoice(voice: Omit<MarketplaceVoice, 'id' | 'createdAt' | 'updatedAt'>): Promise<MarketplaceVoice> {
    if (!this.isAvailable()) {
      throw new Error('Firebase marketplace service is not available');
    }

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

    try {
      await this.db.collection('marketplace_voices').doc(id).set(newVoice);
      return newVoice;
    } catch (error) {
      console.error('Error creating voice in Firebase:', error);
      throw new Error('Failed to create voice in marketplace');
    }
  }

  // Create a new marketplace personality
  async createPersonality(personality: Omit<MarketplacePersonality, 'id' | 'createdAt' | 'updatedAt'>): Promise<MarketplacePersonality> {
    if (!this.isAvailable()) {
      throw new Error('Firebase marketplace service is not available');
    }

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

    try {
      await this.db.collection('marketplace_personalities').doc(id).set(newPersonality);
      return newPersonality;
    } catch (error) {
      console.error('Error creating personality in Firebase:', error);
      throw new Error('Failed to create personality in marketplace');
    }
  }

  // Get marketplace voices with filters
  async getVoices(filters?: {
    category?: string;
    search?: string;
    sortBy?: string;
    limit?: number;
    onlyApproved?: boolean;
  }): Promise<MarketplaceVoice[]> {
    // If Firebase is not available, return sample data
    if (!this.isAvailable()) {
      console.log('Firebase not available, returning sample voices');
      return this.getSampleVoices();
    }

    try {
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
    } catch (error) {
      console.error('Error getting voices from Firebase:', error);
      console.log('Falling back to sample voices');
      return this.getSampleVoices();
    }
  }

  // Get marketplace personalities with filters
  async getPersonalities(filters?: {
    category?: string;
    search?: string;
    sortBy?: string;
    limit?: number;
    onlyApproved?: boolean;
  }): Promise<MarketplacePersonality[]> {
    // If Firebase is not available, return sample data
    if (!this.isAvailable()) {
      console.log('Firebase not available, returning sample personalities');
      return this.getSamplePersonalities();
    }

    try {
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
    } catch (error) {
      console.error('Error getting personalities from Firebase:', error);
      console.log('Falling back to sample personalities');
      return this.getSamplePersonalities();
    }
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

  // Get sample voices for fallback
  private getSampleVoices(): MarketplaceVoice[] {
    return [
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
        createdAt: new Date("2024-01-15T10:00:00Z"),
        updatedAt: new Date("2024-01-15T10:00:00Z"),
        authorId: "user1",
        authorName: "BanterBox Team",
        isVerified: true,
        isActive: true,
        moderationStatus: 'approved'
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
        createdAt: new Date("2024-01-10T14:30:00Z"),
        updatedAt: new Date("2024-01-10T14:30:00Z"),
        authorId: "user2",
        authorName: "BanterBox Team",
        isVerified: true,
        isActive: true,
        moderationStatus: 'approved'
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
        createdAt: new Date("2024-01-20T09:15:00Z"),
        updatedAt: new Date("2024-01-20T09:15:00Z"),
        authorId: "user3",
        authorName: "BanterBox Team",
        isVerified: true,
        isActive: true,
        moderationStatus: 'approved'
      }
    ];
  }

  // Get sample personalities for fallback
  private getSamplePersonalities(): MarketplacePersonality[] {
    return [
      {
        id: "1",
        name: "Gaming Guru",
        description: "Perfect for gaming streams with witty commentary",
        prompt: "You are a gaming expert with deep knowledge of games. Provide insightful commentary, tips, and reactions to gaming moments. Keep responses engaging and informative.",
        category: "Gaming",
        tags: ["gaming", "expert", "commentary"],
        authorId: "user1",
        authorName: "BanterBox Team",
        isVerified: true,
        isActive: true,
        downloads: 1250,
        upvotes: 89,
        downvotes: 3,
        createdAt: new Date("2024-01-15T10:00:00Z"),
        updatedAt: new Date("2024-01-15T10:00:00Z"),
        moderationStatus: 'approved'
      },
      {
        id: "2",
        name: "Comedy Master",
        description: "Hilarious responses that keep everyone laughing",
        prompt: "You are a comedy master who creates hilarious responses. Use clever jokes, puns, and witty observations. Keep the humor clean and entertaining for all ages.",
        category: "Comedy",
        tags: ["comedy", "humor", "entertainment"],
        authorId: "user2",
        authorName: "BanterBox Team",
        isVerified: true,
        isActive: true,
        downloads: 2100,
        upvotes: 156,
        downvotes: 7,
        createdAt: new Date("2024-01-10T14:30:00Z"),
        updatedAt: new Date("2024-01-10T14:30:00Z"),
        moderationStatus: 'approved'
      },
      {
        id: "3",
        name: "Educational Expert",
        description: "Great for educational content and learning streams",
        prompt: "You are an educational expert who explains concepts clearly and engagingly. Provide helpful insights, answer questions, and make learning fun and accessible.",
        category: "Education",
        tags: ["education", "learning", "helpful"],
        authorId: "user3",
        authorName: "BanterBox Team",
        isVerified: true,
        isActive: true,
        downloads: 890,
        upvotes: 67,
        downvotes: 2,
        createdAt: new Date("2024-01-20T09:15:00Z"),
        updatedAt: new Date("2024-01-20T09:15:00Z"),
        moderationStatus: 'approved'
      }
    ];
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
