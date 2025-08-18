import { FirebaseContextService } from "./firebaseContextService.js";
import type { EventType, EventData } from "../shared/schema.js";

/**
 * Context Memory Service
 * Manages AI context memory for creating more coherent, contextual banter responses
 * Uses Firebase Firestore for storage
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
    importance: number = 1,
    originalMessage?: string
  ): Promise<string> {
    return FirebaseContextService.recordEvent(userId, eventType, eventData, guildId, importance, originalMessage);
  }

  /**
   * Gets relevant context for AI banter generation
   */
  static async getContextForBanter(
    userId: string,
    currentEventType: EventType,
    guildId?: string
  ): Promise<string> {
    return FirebaseContextService.getContextForBanter(userId, currentEventType, guildId);
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
    return FirebaseContextService.recordBanterSuccess(userId, eventType, eventData, banterText, guildId);
  }

  /**
   * Updates a context memory with the banter response
   */
  static async updateContextResponse(contextId: string, banterResponse: string): Promise<void> {
    return FirebaseContextService.updateContextResponse(contextId, banterResponse);
  }

  /**
   * Cleans expired context memory
   */
  static async cleanExpiredContext(): Promise<number> {
    return FirebaseContextService.cleanExpiredContext();
  }

  /**
   * Gets a summary of recent stream activity for status displays
   */
  static async getStreamActivitySummary(
    userId: string,
    guildId?: string
  ): Promise<{ totalEvents: number; recentActivity: string; topEventTypes: string[] }> {
    return FirebaseContextService.getStreamActivitySummary(userId, guildId);
  }
}
