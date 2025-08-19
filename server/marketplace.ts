import { db } from "./db";
import { eq, and, desc, sql, like, or, inArray } from "drizzle-orm";
import { 
  marketplaceVoices, 
  marketplacePersonalities, 
  userDownloads, 
  userRatings, 
  contentReports,
  type InsertMarketplaceVoice,
  type InsertMarketplacePersonality,
  type MarketplaceVoice,
  type MarketplacePersonality,
  type UserDownload,
  type ContentReport
} from "@shared/schema";

export class MarketplaceService {
  // Create a new marketplace voice
  async createVoice(voice: InsertMarketplaceVoice): Promise<MarketplaceVoice> {
    const [newVoice] = await db
      .insert(marketplaceVoices)
      .values(voice)
      .returning();
    return newVoice;
  }

  // Create a new marketplace personality
  async createPersonality(personality: InsertMarketplacePersonality): Promise<MarketplacePersonality> {
    const [newPersonality] = await db
      .insert(marketplacePersonalities)
      .values(personality)
      .returning();
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
    let query = db.select().from(marketplaceVoices);
    
    // Apply filters
    const conditions = [];
    
    // Only show active and approved items by default
    if (filters?.onlyApproved !== false) {
      conditions.push(eq(marketplaceVoices.isActive, true));
      conditions.push(eq(marketplaceVoices.moderationStatus, 'approved'));
    }
    
    if (filters?.category && filters.category !== 'all') {
      conditions.push(eq(marketplaceVoices.category, filters.category));
    }
    
    if (filters?.search) {
      const searchTerm = `%${filters.search}%`;
      conditions.push(
        or(
          like(marketplaceVoices.name, searchTerm),
          like(marketplaceVoices.description, searchTerm)
        )
      );
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    // Apply sorting
    switch (filters?.sortBy) {
      case 'newest':
        query = query.orderBy(desc(marketplaceVoices.createdAt));
        break;
      case 'downloads':
        query = query.orderBy(desc(marketplaceVoices.downloads));
        break;
      case 'rating':
        query = query.orderBy(
          desc(sql`${marketplaceVoices.upvotes} - ${marketplaceVoices.downvotes}`)
        );
        break;
      default:
        // Popular: combination of downloads and rating
        query = query.orderBy(
          desc(sql`${marketplaceVoices.downloads} + (${marketplaceVoices.upvotes} - ${marketplaceVoices.downvotes}) * 10`)
        );
    }
    
    // Apply limit
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    
    return await query;
  }

  // Get marketplace personalities with filters
  async getPersonalities(filters?: {
    category?: string;
    search?: string;
    sortBy?: string;
    limit?: number;
    onlyApproved?: boolean;
  }): Promise<MarketplacePersonality[]> {
    let query = db.select().from(marketplacePersonalities);
    
    // Apply filters
    const conditions = [];
    
    // Only show active and approved items by default
    if (filters?.onlyApproved !== false) {
      conditions.push(eq(marketplacePersonalities.isActive, true));
      conditions.push(eq(marketplacePersonalities.moderationStatus, 'approved'));
    }
    
    if (filters?.category && filters.category !== 'all') {
      conditions.push(eq(marketplacePersonalities.category, filters.category));
    }
    
    if (filters?.search) {
      const searchTerm = `%${filters.search}%`;
      conditions.push(
        or(
          like(marketplacePersonalities.name, searchTerm),
          like(marketplacePersonalities.description, searchTerm)
        )
      );
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    // Apply sorting
    switch (filters?.sortBy) {
      case 'newest':
        query = query.orderBy(desc(marketplacePersonalities.createdAt));
        break;
      case 'downloads':
        query = query.orderBy(desc(marketplacePersonalities.downloads));
        break;
      case 'rating':
        query = query.orderBy(
          desc(sql`${marketplacePersonalities.upvotes} - ${marketplacePersonalities.downvotes}`)
        );
        break;
      default:
        // Popular: combination of downloads and rating
        query = query.orderBy(
          desc(sql`${marketplacePersonalities.downloads} + (${marketplacePersonalities.upvotes} - ${marketplacePersonalities.downvotes}) * 10`)
        );
    }
    
    // Apply limit
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    
    return await query;
  }

  // Get a single voice
  async getVoice(id: string): Promise<MarketplaceVoice | undefined> {
    const [voice] = await db
      .select()
      .from(marketplaceVoices)
      .where(eq(marketplaceVoices.id, id));
    return voice;
  }

  // Get a single personality
  async getPersonality(id: string): Promise<MarketplacePersonality | undefined> {
    const [personality] = await db
      .select()
      .from(marketplacePersonalities)
      .where(eq(marketplacePersonalities.id, id));
    return personality;
  }

  // Download an item
  async downloadItem(userId: string, itemType: 'voice' | 'personality', itemId: string): Promise<UserDownload> {
    // Check if already downloaded
    const existing = await db
      .select()
      .from(userDownloads)
      .where(
        and(
          eq(userDownloads.userId, userId),
          eq(userDownloads.itemType, itemType),
          eq(userDownloads.itemId, itemId)
        )
      );
    
    if (existing.length > 0) {
      return existing[0];
    }
    
    // Create download record
    const [download] = await db
      .insert(userDownloads)
      .values({ userId, itemType, itemId })
      .returning();
    
    // Increment download count
    if (itemType === 'voice') {
      await db
        .update(marketplaceVoices)
        .set({ downloads: sql`${marketplaceVoices.downloads} + 1` })
        .where(eq(marketplaceVoices.id, itemId));
    } else {
      await db
        .update(marketplacePersonalities)
        .set({ downloads: sql`${marketplacePersonalities.downloads} + 1` })
        .where(eq(marketplacePersonalities.id, itemId));
    }
    
    return download;
  }

  // Check if user has downloaded an item
  async hasUserDownloaded(userId: string, itemType: 'voice' | 'personality', itemId: string): Promise<boolean> {
    const [download] = await db
      .select()
      .from(userDownloads)
      .where(
        and(
          eq(userDownloads.userId, userId),
          eq(userDownloads.itemType, itemType),
          eq(userDownloads.itemId, itemId)
        )
      );
    return !!download;
  }

  // Rate an item
  async rateItem(userId: string, itemType: 'voice' | 'personality', itemId: string, rating: 1 | -1): Promise<void> {
    // Check for existing rating
    const [existingRating] = await db
      .select()
      .from(userRatings)
      .where(
        and(
          eq(userRatings.userId, userId),
          eq(userRatings.itemType, itemType),
          eq(userRatings.itemId, itemId)
        )
      );
    
    const table = itemType === 'voice' ? marketplaceVoices : marketplacePersonalities;
    
    if (existingRating) {
      const oldRating = existingRating.rating;
      
      // Update rating
      await db
        .update(userRatings)
        .set({ rating, updatedAt: new Date() })
        .where(eq(userRatings.id, existingRating.id));
      
      // Update item counts
      if (oldRating !== rating) {
        if (oldRating === 1) {
          // Was upvote, decrease upvotes
          await db
            .update(table)
            .set({ upvotes: sql`${table.upvotes} - 1` })
            .where(eq(table.id, itemId));
        } else {
          // Was downvote, decrease downvotes
          await db
            .update(table)
            .set({ downvotes: sql`${table.downvotes} - 1` })
            .where(eq(table.id, itemId));
        }
        
        if (rating === 1) {
          // Now upvote, increase upvotes
          await db
            .update(table)
            .set({ upvotes: sql`${table.upvotes} + 1` })
            .where(eq(table.id, itemId));
        } else {
          // Now downvote, increase downvotes
          await db
            .update(table)
            .set({ downvotes: sql`${table.downvotes} + 1` })
            .where(eq(table.id, itemId));
        }
      }
    } else {
      // Create new rating
      await db
        .insert(userRatings)
        .values({ userId, itemType, itemId, rating });
      
      // Update item counts
      if (rating === 1) {
        await db
          .update(table)
          .set({ upvotes: sql`${table.upvotes} + 1` })
          .where(eq(table.id, itemId));
      } else {
        await db
          .update(table)
          .set({ downvotes: sql`${table.downvotes} + 1` })
          .where(eq(table.id, itemId));
      }
    }
  }

  // Get user's rating for an item
  async getUserRating(userId: string, itemType: 'voice' | 'personality', itemId: string): Promise<number | null> {
    const [rating] = await db
      .select()
      .from(userRatings)
      .where(
        and(
          eq(userRatings.userId, userId),
          eq(userRatings.itemType, itemType),
          eq(userRatings.itemId, itemId)
        )
      );
    return rating?.rating || null;
  }

  // Moderate an item
  async moderateItem(
    itemType: 'voice' | 'personality',
    itemId: string,
    status: 'approved' | 'rejected',
    moderatorId: string,
    notes?: string
  ): Promise<void> {
    const table = itemType === 'voice' ? marketplaceVoices : marketplacePersonalities;
    
    await db
      .update(table)
      .set({
        moderationStatus: status,
        moderatedBy: moderatorId,
        moderatedAt: new Date(),
        moderationNotes: notes,
        isActive: status === 'approved'
      })
      .where(eq(table.id, itemId));
  }

  // Get pending moderation items
  async getPendingModerationItems(): Promise<{
    voices: MarketplaceVoice[];
    personalities: MarketplacePersonality[];
  }> {
    const voices = await db
      .select()
      .from(marketplaceVoices)
      .where(eq(marketplaceVoices.moderationStatus, 'pending'))
      .orderBy(marketplaceVoices.createdAt);
    
    const personalities = await db
      .select()
      .from(marketplacePersonalities)
      .where(eq(marketplacePersonalities.moderationStatus, 'pending'))
      .orderBy(marketplacePersonalities.createdAt);
    
    return { voices, personalities };
  }

  // Report content
  async reportContent(report: {
    reporterId: string;
    itemType: 'voice' | 'personality';
    itemId: string;
    reason: string;
    description?: string;
  }): Promise<ContentReport> {
    const [newReport] = await db
      .insert(contentReports)
      .values(report)
      .returning();
    return newReport;
  }

  // Get content reports
  async getContentReports(status?: string): Promise<ContentReport[]> {
    let query = db.select().from(contentReports);
    
    if (status) {
      query = query.where(eq(contentReports.status, status));
    }
    
    return await query.orderBy(desc(contentReports.createdAt));
  }

  // Review a report
  async reviewReport(
    reportId: string,
    reviewerId: string,
    status: 'resolved' | 'dismissed',
    notes?: string
  ): Promise<void> {
    await db
      .update(contentReports)
      .set({
        status,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNotes: notes
      })
      .where(eq(contentReports.id, reportId));
  }

  // Get user's marketplace items
  async getUserMarketplaceItems(userId: string): Promise<{
    voices: MarketplaceVoice[];
    personalities: MarketplacePersonality[];
  }> {
    const voices = await db
      .select()
      .from(marketplaceVoices)
      .where(eq(marketplaceVoices.authorId, userId))
      .orderBy(desc(marketplaceVoices.createdAt));
    
    const personalities = await db
      .select()
      .from(marketplacePersonalities)
      .where(eq(marketplacePersonalities.authorId, userId))
      .orderBy(desc(marketplacePersonalities.createdAt));
    
    return { voices, personalities };
  }
}

// Export singleton instance
export const marketplaceService = new MarketplaceService();
