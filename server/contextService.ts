import { storage } from './storage.js';
import { InsertContextMemory, EventType, EventData } from '@shared/schema.js';

/**
 * Context Memory Service
 * Manages AI context memory for creating more coherent, contextual banter responses
 */
export class ContextService {
  /**
   * Records a new event in context memory for future AI reference
   */
  static async recordEvent(
    userId: string,
    eventType: EventType,
    eventData: EventData,
    guildId?: string,
    importance: number = 1
  ): Promise<void> {
    // Generate context summary based on event type
    const contextSummary = this.generateContextSummary(eventType, eventData);
    
    // Calculate expiration time based on importance (more important = longer retention)
    const hoursToRetain = Math.max(1, importance * 2); // 1-20 hours based on importance
    const expiresAt = new Date(Date.now() + (hoursToRetain * 60 * 60 * 1000));

    const contextMemory: InsertContextMemory = {
      userId,
      guildId: guildId || null,
      eventType,
      eventData,
      contextSummary,
      importance: Math.min(10, Math.max(1, importance)), // Clamp between 1-10
      expiresAt,
    };

    await storage.createContextMemory(contextMemory);
    
    // Clean expired context occasionally
    if (Math.random() < 0.1) { // 10% chance
      await storage.cleanExpiredContext();
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
    // DISABLED: Context feature is too aggressive and references other users inappropriately
    // Return empty string to disable context injection into AI prompts
    return '';
    
    // Original implementation commented out:
    /*
    // Get recent general context
    const recentContext = await storage.getRecentContext(userId, guildId, 5);
    
    // Get specific context for similar events
    const similarEventContext = await storage.getContextByEventType(userId, currentEventType, guildId, 3);
    
    // Build context prompt
    let contextPrompt = '';
    
    if (recentContext.length > 0) {
      const recentSummary = recentContext
        .map(ctx => ctx.contextSummary)
        .filter(s => s)
        .join('. ');
      
      if (recentSummary) {
        contextPrompt += `Recent stream activity: ${recentSummary}. `;
      }
    }

    if (similarEventContext.length > 0) {
      const similarSummary = similarEventContext
        .map(ctx => ctx.contextSummary)
        .filter(s => s)
        .slice(0, 2) // Limit to avoid too much context
        .join('. ');
      
      if (similarSummary) {
        contextPrompt += `Previous ${currentEventType} events: ${similarSummary}. `;
      }
    }

    // Add guidance for using context
    if (contextPrompt) {
      contextPrompt = `Context (reference this naturally in your response): ${contextPrompt}Use this context to create a more engaging, contextual response that acknowledges recent stream activity. `;
    }

    return contextPrompt;
    */
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
    const contextSummary = `Generated successful banter "${banterText.substring(0, 50)}..." for ${eventType}`;
    
    await this.recordEvent(userId, eventType, { ...eventData, banterText }, guildId, 2); // Higher importance for successful banters
  }

  /**
   * Generates human-readable context summaries for events
   */
  private static generateContextSummary(eventType: EventType, eventData: EventData): string {
    switch (eventType) {
      case 'chat':
        return `${eventData.username || 'Someone'} chatted${eventData.message ? ': "' + eventData.message.substring(0, 30) + '"' : ''}`;
      
      case 'subscription':
        return `${eventData.username || 'Someone'} subscribed${eventData.amount ? ` with a $${eventData.amount} sub` : ''}`;
      
      case 'donation':
        return `${eventData.username || 'Someone'} donated $${eventData.amount || 0}${eventData.message ? ' saying "' + eventData.message.substring(0, 30) + '"' : ''}`;
      
      case 'raid':
        return `${eventData.username || 'Someone'} raided with ${eventData.raiderCount || 0} viewers`;
      
      case 'discord_message':
        const content = eventData.messageContent || eventData.message || '';
        return `${eventData.username || eventData.displayName || 'Someone'} sent message in Discord${content ? ': "' + content.substring(0, 30) + '"' : ''}`;
      
      case 'discord_member_join':
        return `${eventData.username || eventData.displayName || 'Someone'} joined the Discord server`;
      
      case 'discord_reaction':
        return `${eventData.username || eventData.displayName || 'Someone'} reacted with ${eventData.emoji || 'emoji'} in Discord`;
      
      default:
        return `${eventData.username || 'Someone'} triggered ${eventType} event`;
    }
  }

  /**
   * Gets a summary of recent stream activity for status displays
   */
  static async getStreamActivitySummary(userId: string, guildId?: string): Promise<{
    totalEvents: number;
    recentActivity: string;
    topEventTypes: string[];
  }> {
    const recentContext = await storage.getRecentContext(userId, guildId, 20);
    
    if (recentContext.length === 0) {
      return {
        totalEvents: 0,
        recentActivity: "No recent activity",
        topEventTypes: []
      };
    }

    // Count event types
    const eventCounts = recentContext.reduce((acc, ctx) => {
      acc[ctx.eventType] = (acc[ctx.eventType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topEventTypes = Object.entries(eventCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([type]) => type);

    const recentActivity = recentContext
      .slice(0, 3)
      .map(ctx => ctx.contextSummary)
      .filter(s => s)
      .join('; ');

    return {
      totalEvents: recentContext.length,
      recentActivity,
      topEventTypes
    };
  }
}
