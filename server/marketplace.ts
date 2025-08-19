import { firebaseStorage } from "./firebaseStorage";
import { 
  type InsertMarketplaceVoice,
  type InsertMarketplacePersonality,
  type MarketplaceVoice,
  type MarketplacePersonality,
  type UserDownload,
  type ContentReport
} from "../shared/schema";

export class MarketplaceService {
  // Create a new marketplace voice
  async createVoice(voice: InsertMarketplaceVoice): Promise<MarketplaceVoice> {
    return await firebaseStorage.createMarketplaceVoice(voice);
  }

  // Create a new marketplace personality
  async createPersonality(personality: InsertMarketplacePersonality): Promise<MarketplacePersonality> {
    return await firebaseStorage.createMarketplacePersonality(personality);
  }

  // Get marketplace voices with filters
  async getVoices(filters?: {
    category?: string;
    search?: string;
    sortBy?: string;
    limit?: number;
    onlyApproved?: boolean;
  }): Promise<MarketplaceVoice[]> {
    return await firebaseStorage.getMarketplaceVoices(filters);
  }

  // Get marketplace personalities with filters
  async getPersonalities(filters?: {
    category?: string;
    search?: string;
    sortBy?: string;
    limit?: number;
    onlyApproved?: boolean;
  }): Promise<MarketplacePersonality[]> {
    return await firebaseStorage.getMarketplacePersonalities(filters);
  }

  // Get a specific marketplace voice
  async getVoice(id: string): Promise<MarketplaceVoice | undefined> {
    return await firebaseStorage.getMarketplaceVoice(id);
  }

  // Get a specific marketplace personality
  async getPersonality(id: string): Promise<MarketplacePersonality | undefined> {
    return await firebaseStorage.getMarketplacePersonality(id);
  }

  // Update a marketplace item
  async updateItem(itemType: 'voice' | 'personality', id: string, updates: any): Promise<void> {
    return await firebaseStorage.updateMarketplaceItem(itemType, id, updates);
  }

  // Download a marketplace item
  async downloadItem(userId: string, itemType: 'voice' | 'personality', itemId: string): Promise<UserDownload> {
    return await firebaseStorage.downloadMarketplaceItem(userId, itemType, itemId);
  }

  // Check if user has downloaded an item
  async hasUserDownloaded(userId: string, itemType: 'voice' | 'personality', itemId: string): Promise<boolean> {
    return await firebaseStorage.hasUserDownloaded(userId, itemType, itemId);
  }

  // Rate a marketplace item
  async rateItem(userId: string, itemType: 'voice' | 'personality', itemId: string, rating: 1 | -1): Promise<void> {
    return await firebaseStorage.rateMarketplaceItem(userId, itemType, itemId, rating);
  }

  // Get user's rating for an item
  async getUserRating(userId: string, itemType: 'voice' | 'personality', itemId: string): Promise<number | null> {
    return await firebaseStorage.getUserRating(userId, itemType, itemId);
  }

  // Moderate a marketplace item
  async moderateItem(itemType: 'voice' | 'personality', itemId: string, status: 'approved' | 'rejected', moderatorId: string, notes?: string): Promise<void> {
    return await firebaseStorage.moderateMarketplaceItem(itemType, itemId, status, moderatorId, notes);
  }

  // Get pending moderation items
  async getPendingModerationItems(): Promise<{ voices: MarketplaceVoice[]; personalities: MarketplacePersonality[] }> {
    return await firebaseStorage.getPendingModerationItems();
  }

  // Report content
  async reportContent(report: any): Promise<ContentReport> {
    return await firebaseStorage.reportContent(report);
  }

  // Get content reports
  async getContentReports(status?: string): Promise<ContentReport[]> {
    return await firebaseStorage.getContentReports(status);
  }

  // Review a report
  async reviewReport(reportId: string, reviewerId: string, status: 'resolved' | 'dismissed', notes?: string): Promise<void> {
    return await firebaseStorage.reviewReport(reportId, reviewerId, status, notes);
  }
}

// Export singleton instance
export const marketplaceService = new MarketplaceService();
