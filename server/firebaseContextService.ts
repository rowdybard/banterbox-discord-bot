import { getFirestoreDb } from './firebase.js';
import type { EventType, EventData } from '../shared/schema.js';

/**
 * Firebase-based Context Memory Service
 * Manages AI context memory using Firestore for creating more coherent, contextual banter responses
 */
export class FirebaseContextService {
  private db: any;

  constructor() {
    this.db = getFirestoreDb();
  }

  /**
   * Records a new event in context memory for future AI reference
   */
  static async recordEvent(
    userId: string,
    eventType: EventType,
    eventData: EventData,
    guildId?: string,
    importance: number = 1,
    originalMessage?: string
  ): Promise<string> {
    try {
      const db = getFirestoreDb();
      if (!db) {
        console.log('Firestore not available, skipping context recording');
        return 'firestore-unavailable';
      }

      // Generate context summary based on event type
      const contextSummary = this.generateContextSummary(eventType, eventData);

      // Revolutionary 72-hour context window for experimental long-term memory
      const hoursToRetain = 72; // Fixed 72-hour retention for all context
      const expiresAt = new Date(Date.now() + hoursToRetain * 60 * 60 * 1000);

      // Extract participants from event data
      const participants: string[] = [];
      if (eventData.displayName) participants.push(eventData.displayName);
      if (eventData.username) participants.push(eventData.username);

      const contextMemory = {
        userId,
        guildId: guildId || null,
        eventType,
        eventData,
        contextSummary,
        originalMessage: originalMessage || null,
        banterResponse: null,
        importance: Math.min(10, Math.max(1, importance)), // Clamp between 1-10
        participants,
        createdAt: new Date(),
        expiresAt,
      };

      const docRef = await db.collection('contextMemory').add(contextMemory);
      console.log(`Context memory recorded with ID: ${docRef.id}`);

      // Clean expired context occasionally
      if (Math.random() < 0.1) {
        // 10% chance
        await this.cleanExpiredContext();
      }

      return docRef.id;
    } catch (error) {
      console.error('Error recording context memory:', error);
      return 'error';
    }
  }

  /**
   * Gets relevant context for AI banter generation
   */
  static async getContextForBanter(
    userId: string,
    currentEventType: EventType,
    guildId?: string
  ): Promise<string> {
    try {
      const db = getFirestoreDb();
      if (!db) {
        console.log('Firestore not available, returning empty context');
        return '';
      }

      console.log(`Getting context for user ${userId}, event type ${currentEventType}, guild ${guildId}`);
      
      // Ultra-simplified query: Get all context for user and filter in memory
      // This avoids any composite index requirements
      const recentContextSnapshot = await db.collection('contextMemory')
        .where('userId', '==', userId)
        .limit(50) // Get more items and filter in memory
        .get();

      const allContext = recentContextSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      
      // Filter by expiration date in memory
      const validContext = allContext.filter((ctx: any) => {
        const expiresAt = ctx.expiresAt?.toDate ? ctx.expiresAt.toDate() : new Date(ctx.expiresAt);
        return expiresAt > new Date();
      });
      
      // Revolutionary Smart Context Logic - Only use context when it makes sense
      const shouldUseContext = this.shouldUseContextForEvent(currentEventType, validContext.length);
      
      if (!shouldUseContext) {
        console.log('Smart context logic: Skipping context for this event type');
        return '';
      }
      
      // Filter by guildId if specified
      const guildContext = guildId 
        ? validContext.filter((ctx: any) => ctx.guildId === guildId)
        : validContext.filter((ctx: any) => !ctx.guildId);
      
      // Get global context (no guildId) if we have guildId specified
      const globalContext = guildId 
        ? validContext.filter((ctx: any) => !ctx.guildId)
        : [];
      
      // Combine and sort by creation date - limit to prevent overwhelming
      const combinedContext = [...guildContext, ...globalContext]
        .sort((a: any, b: any) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, 4); // Reduced from 8 to 4 for less overwhelming context
      
      console.log(`Found ${combinedContext.length} total recent context items`);
      
      // Get similar event context (filter in memory instead of query)
      const similarContext = validContext
        .filter((ctx: any) => ctx.eventType === currentEventType)
        .filter((ctx: any) => {
          if (guildId) {
            return ctx.guildId === guildId || !ctx.guildId;
          } else {
            return !ctx.guildId;
          }
        })
        .sort((a: any, b: any) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, 2); // Reduced from 5 to 2 for less overwhelming context
      
      console.log(`Found ${similarContext.length} similar context items`);
      
      if (combinedContext.length === 0 && similarContext.length === 0) {
        console.log('No context found, returning empty string');
        return '';
      }
      
      let contextString = '';
      
      // Smart Context Formatting - Less repetitive and more varied
      if (combinedContext.length > 0) {
        // Only include context if it's recent and varied
        const recentMessages = combinedContext
          .filter((ctx: any) => ctx.originalMessage && ctx.originalMessage.length > 5)
          .slice(0, 3); // Take up to 3 recent messages
        
        if (recentMessages.length > 0) {
          contextString += 'Recent conversation:\n';
          recentMessages.forEach((ctx: any, index: number) => {
            const message = ctx.originalMessage.substring(0, 100); // Limit message length
            contextString += `- ${message}\n`;
          });
          contextString += '\n';
        }
      }
      
      // Only add similar context occasionally and with variety
      if (similarContext.length > 0 && Math.random() < 0.2) { // Reduced from 0.3 to 0.2
        const uniqueResponses = similarContext
          .filter((ctx: any) => ctx.banterResponse && ctx.banterResponse.length > 10)
          .slice(0, 1); // Only show 1 similar response
        
        if (uniqueResponses.length > 0) {
          contextString += `Previous response example:\n`;
          uniqueResponses.forEach((ctx: any) => {
            const response = ctx.banterResponse.substring(0, 80); // Limit response length
            contextString += `- "${response}"\n`;
          });
          contextString += '\n';
        }
      }
      
      // Smart Context Instruction - Encourage variety
      if (contextString) {
        contextString += 'Use this context for natural conversation flow, but keep responses fresh and varied. Don\'t repeat the same phrases or references too often.';
      }
      
      return contextString;
    } catch (error) {
      console.error('Error getting context for banter:', error);
      return '';
    }
  }

  /**
   * Records a successful banter interaction to improve future context
   */
  static async recordBanterSuccess(
    userId: string,
    eventType: EventType,
    eventData: EventData,
    banterText: string,
    guildId?: string
  ): Promise<void> {
    // Record successful banter patterns for future reference
    await this.recordEvent(userId, eventType, { ...eventData, banterText }, guildId, 3); // Higher importance for successful banters
  }

  /**
   * Updates a context memory with the banter response
   */
  static async updateContextResponse(contextId: string, banterResponse: string): Promise<void> {
    try {
      const db = getFirestoreDb();
      if (!db) return;

              await db.collection('contextMemory').doc(contextId).update({
        banterResponse,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating context response:', error);
    }
  }

  /**
   * Smart Context Logic - Determines when to use context
   */
  static shouldUseContextForEvent(eventType: EventType, contextCount: number): boolean {
    // Don't use context if we have too much (overwhelming)
    if (contextCount > 20) {
      return false;
    }
    
    // Always use context for these event types (they benefit from continuity)
    const alwaysUseContext = ['discord_message', 'chat'];
    if (alwaysUseContext.includes(eventType)) {
      return true; // Always use context for messages
    }
    
    // Sometimes use context for these event types
    const sometimesUseContext = ['subscription', 'donation', 'raid', 'discord_member_join'];
    if (sometimesUseContext.includes(eventType)) {
      return contextCount > 0; // Use context if we have any
    }
    
    // Rarely use context for these event types (keep them fresh)
    const rarelyUseContext = ['discord_reaction', 'follow', 'cheer'];
    if (rarelyUseContext.includes(eventType)) {
      return contextCount > 5; // Only use context if we have significant history
    }
    
    // Default: use context if available
    return contextCount > 0;
  }

  /**
   * Cleans expired context memory
   */
  static async cleanExpiredContext(): Promise<number> {
    try {
      const db = getFirestoreDb();
      if (!db) return 0;

      const expiredSnapshot = await db.collection('contextMemory')
        .where('expiresAt', '<', new Date())
        .limit(100) // Process in batches
        .get();

      const batch = db.batch();
      expiredSnapshot.docs.forEach((doc: any) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`Cleaned ${expiredSnapshot.docs.length} expired context items`);
      return expiredSnapshot.docs.length;
    } catch (error) {
      console.error('Error cleaning expired context:', error);
      return 0;
    }
  }

  /**
   * Generates human-readable context summaries for events
   */
  private static generateContextSummary(eventType: EventType, eventData: EventData): string {
    switch (eventType) {
      case 'chat':
        return `${eventData.username || 'Someone'} chatted${
          eventData.message ? ': "' + eventData.message.substring(0, 50) + '"' : ''
        }`;

      case 'subscription':
        return `${eventData.username || 'Someone'} subscribed$${
          eventData.amount ? ` with a $${eventData.amount} sub` : ''
        }`;

      case 'donation':
        return `${eventData.username || 'Someone'} donated $${
          eventData.amount || 0
        }${eventData.message ? ' saying "' + eventData.message.substring(0, 50) + '"' : ''}`;

      case 'raid':
        return `${eventData.username || 'Someone'} raided with ${eventData.raiderCount || 0} viewers`;

      case 'discord_message': {
        const content = eventData.messageContent || eventData.message || '';
        return `${
          eventData.username || eventData.displayName || 'Someone'
        } sent message in Discord${content ? ': "' + content.substring(0, 50) + '"' : ''}`;
      }

      case 'discord_member_join':
        return `${eventData.username || eventData.displayName || 'Someone'} joined the Discord server`;

      case 'discord_reaction':
        return `${eventData.username || eventData.displayName || 'Someone'} reacted with ${
          eventData.emoji || 'emoji'
        } in Discord`;

      default:
        return `${eventData.username || 'Someone'} triggered ${eventType} event`;
    }
  }

  /**
   * Gets a summary of recent stream activity for status displays
   */
  static async getStreamActivitySummary(
    userId: string,
    guildId?: string
  ): Promise<{ totalEvents: number; recentActivity: string; topEventTypes: string[] }> {
    try {
      const db = getFirestoreDb();
      if (!db) {
        return { totalEvents: 0, recentActivity: 'No recent activity', topEventTypes: [] };
      }

      // Ultra-simplified query: Get all context for user and filter in memory
      const snapshot = await db.collection('contextMemory')
        .where('userId', '==', userId)
        .limit(50) // Get more items and filter/sort in memory
        .get();

      let recentContext = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

      // Filter by expiration date in memory
      recentContext = recentContext.filter((ctx: any) => {
        const expiresAt = ctx.expiresAt?.toDate ? ctx.expiresAt.toDate() : new Date(ctx.expiresAt);
        return expiresAt > new Date();
      });

      // Filter by guildId if specified
      if (guildId) {
        const guildContext = recentContext.filter((ctx: any) => ctx.guildId === guildId);
        const globalContext = recentContext.filter((ctx: any) => !ctx.guildId);
        recentContext = [...guildContext, ...globalContext];
      } else {
        recentContext = recentContext.filter((ctx: any) => !ctx.guildId);
      }

      // Sort by creation date in memory
      recentContext.sort((a: any, b: any) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });
      recentContext = recentContext.slice(0, 20); // Take top 20

      if (!recentContext.length) {
        return { totalEvents: 0, recentActivity: 'No recent activity', topEventTypes: [] };
      }

      // Count event types
      const eventCounts = recentContext.reduce((acc: Record<string, number>, ctx: any) => {
        acc[ctx.eventType] = (acc[ctx.eventType] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Top 3 event types
      const topEventTypes = Object.entries(eventCounts)
        .sort(([, a]: [string, any], [, b]: [string, any]) => b - a)
        .slice(0, 3)
        .map(([type]) => type);

      // Short recent activity summary
      const recentActivity = recentContext
        .map((c: any) => c.contextSummary)
        .filter((s: any): s is string => Boolean(s))
        .slice(0, 3)
        .join('; ');

      return {
        totalEvents: recentContext.length,
        recentActivity,
        topEventTypes,
      };
    } catch (error) {
      console.error('Error getting stream activity summary:', error);
      return { totalEvents: 0, recentActivity: 'Error getting activity', topEventTypes: [] };
    }
  }
}
