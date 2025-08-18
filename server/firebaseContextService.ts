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

      // Calculate expiration time based on importance (more important = longer retention)
      const hoursToRetain = Math.max(2, importance * 3); // 2-30 hours based on importance
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

      const docRef = await db.collection('context_memory').add(contextMemory);
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
      
      // Get recent context (last 8 interactions for better memory)
      let recentContextQuery = db.collection('context_memory')
        .where('userId', '==', userId)
        .where('expiresAt', '>', new Date())
        .orderBy('expiresAt', 'desc')
        .orderBy('createdAt', 'desc')
        .limit(8);

      if (guildId) {
        recentContextQuery = recentContextQuery.where('guildId', '==', guildId);
      }

      const recentContextSnapshot = await recentContextQuery.get();
      const recentContext = recentContextSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log(`Found ${recentContext.length} recent context items with guildId ${guildId}`);
      
      // If we don't have enough context with guildId, also get context without guildId
      if (recentContext.length < 4 && guildId) {
        const globalContextSnapshot = await db.collection('context_memory')
          .where('userId', '==', userId)
          .where('expiresAt', '>', new Date())
          .orderBy('expiresAt', 'desc')
          .orderBy('createdAt', 'desc')
          .limit(8)
          .get();
        
        const globalContext = globalContextSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`Found ${globalContext.length} global context items (no guildId)`);
        
        // Combine and deduplicate context
        const allContext = [...recentContext, ...globalContext];
        const uniqueContext = allContext.filter((ctx, index, self) => 
          index === self.findIndex(c => c.id === ctx.id)
        );
        recentContext.splice(0, recentContext.length, ...uniqueContext.slice(0, 8));
        console.log(`Combined to ${recentContext.length} total recent context items`);
      }
      
      // Get similar event context (last 5 of same type)
      let similarContextQuery = db.collection('context_memory')
        .where('userId', '==', userId)
        .where('eventType', '==', currentEventType)
        .where('expiresAt', '>', new Date())
        .orderBy('expiresAt', 'desc')
        .orderBy('createdAt', 'desc')
        .limit(5);

      if (guildId) {
        similarContextQuery = similarContextQuery.where('guildId', '==', guildId);
      }

      const similarContextSnapshot = await similarContextQuery.get();
      let similarContext = similarContextSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log(`Found ${similarContext.length} similar context items with guildId ${guildId}`);
      
      if (similarContext.length < 3 && guildId) {
        const globalSimilarContextSnapshot = await db.collection('context_memory')
          .where('userId', '==', userId)
          .where('eventType', '==', currentEventType)
          .where('expiresAt', '>', new Date())
          .orderBy('expiresAt', 'desc')
          .orderBy('createdAt', 'desc')
          .limit(5)
          .get();
        
        const globalSimilarContext = globalSimilarContextSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`Found ${globalSimilarContext.length} global similar context items (no guildId)`);
        
        // Combine and deduplicate similar context
        const allSimilarContext = [...similarContext, ...globalSimilarContext];
        const uniqueSimilarContext = allSimilarContext.filter((ctx, index, self) => 
          index === self.findIndex(c => c.id === ctx.id)
        );
        similarContext = uniqueSimilarContext.slice(0, 5);
        console.log(`Combined to ${similarContext.length} total similar context items`);
      }
      
      if (recentContext.length === 0 && similarContext.length === 0) {
        console.log('No context found, returning empty string');
        return '';
      }
      
      let contextString = '';
      
      // Add recent conversation context with better formatting
      if (recentContext.length > 0) {
        contextString += 'Recent conversation history:\n';
        recentContext.reverse().forEach((ctx, index) => {
          if (ctx.originalMessage) {
            contextString += `${index + 1}. User said: "${ctx.originalMessage}"\n`;
          }
          if (ctx.banterResponse) {
            contextString += `   You responded: "${ctx.banterResponse}"\n`;
          }
        });
        contextString += '\n';
      }
      
      // Add similar event context for variety
      if (similarContext.length > 0) {
        contextString += `Previous responses to similar ${currentEventType} events:\n`;
        similarContext.forEach((ctx, index) => {
          if (ctx.banterResponse) {
            contextString += `${index + 1}. "${ctx.banterResponse}"\n`;
          }
        });
        contextString += '\n';
      }
      
      // Add improved context instruction with specific guidance for car mentions
      if (contextString) {
        contextString += 'IMPORTANT: Use this conversation history to provide contextually aware responses. Remember what was discussed and refer back to it naturally. If someone mentioned something specific (like a car model, hobby, etc.), reference it naturally in your response. For example, if someone mentioned they drive an Altima, remember that and refer to it in future responses. Be creative and varied while staying connected to the conversation.';
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

      await db.collection('context_memory').doc(contextId).update({
        banterResponse,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating context response:', error);
    }
  }

  /**
   * Cleans expired context memory
   */
  static async cleanExpiredContext(): Promise<number> {
    try {
      const db = getFirestoreDb();
      if (!db) return 0;

      const expiredSnapshot = await db.collection('context_memory')
        .where('expiresAt', '<', new Date())
        .limit(100) // Process in batches
        .get();

      const batch = db.batch();
      expiredSnapshot.docs.forEach(doc => {
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

      let query = db.collection('context_memory')
        .where('userId', '==', userId)
        .where('expiresAt', '>', new Date())
        .orderBy('expiresAt', 'desc')
        .orderBy('createdAt', 'desc')
        .limit(20);

      if (guildId) {
        query = query.where('guildId', '==', guildId);
      }

      const snapshot = await query.get();
      const recentContext = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (!recentContext.length) {
        return { totalEvents: 0, recentActivity: 'No recent activity', topEventTypes: [] };
      }

      // Count event types
      const eventCounts = recentContext.reduce<Record<string, number>>((acc, ctx) => {
        acc[ctx.eventType] = (acc[ctx.eventType] ?? 0) + 1;
        return acc;
      }, {});

      // Top 3 event types
      const topEventTypes = Object.entries(eventCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([type]) => type);

      // Short recent activity summary
      const recentActivity = recentContext
        .map((c) => c.contextSummary)
        .filter((s): s is string => Boolean(s))
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
