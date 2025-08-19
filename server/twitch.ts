import WebSocket from "ws";
import { firebaseStorage } from "./firebaseStorage";

interface TwitchEventSubMessage {
  metadata: {
    message_id: string;
    message_type: string;
    message_timestamp: string;
    subscription_type?: string;
    subscription_version?: string;
  };
  payload: {
    session?: {
      id: string;
      status: string;
      connected_at: string;
      keepalive_timeout_seconds: number;
      reconnect_url?: string;
    };
    subscription?: {
      id: string;
      status: string;
      type: string;
      version: string;
      condition: any;
      transport: any;
      created_at: string;
    };
    event?: any;
  };
}

export interface TwitchSettings {
  accessToken?: string;
  refreshToken?: string;
  username?: string;
  userId?: string;
  isConnected: boolean;
  enabledEvents: string[];
}

export class TwitchEventSubClient {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private accessToken: string;
  private clientId: string;
  private reconnectUrl: string | null = null;
  private keepaliveTimeout: NodeJS.Timeout | null = null;
  private isReconnecting = false;

  constructor(accessToken: string, clientId: string = process.env.TWITCH_CLIENT_ID || "") {
    this.accessToken = accessToken;
    this.clientId = clientId;
  }

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log("Twitch EventSub already connected");
      return;
    }

    console.log("Connecting to Twitch EventSub...");
    
    const wsUrl = this.reconnectUrl || "wss://eventsub.wss.twitch.tv/ws";
    this.ws = new WebSocket(wsUrl);

    this.ws.on("open", () => {
      console.log("Connected to Twitch EventSub WebSocket");
    });

    this.ws.on("message", (data) => {
      try {
        const message: TwitchEventSubMessage = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch (error) {
        console.error("Error parsing Twitch EventSub message:", error);
      }
    });

    this.ws.on("close", (code, reason) => {
      console.log(`Twitch EventSub WebSocket closed: ${code} ${reason.toString()}`);
      
      if (this.keepaliveTimeout) {
        clearTimeout(this.keepaliveTimeout);
        this.keepaliveTimeout = null;
      }

      // Attempt to reconnect unless it's a deliberate close
      if (code !== 1000 && !this.isReconnecting) {
        this.attemptReconnect();
      }
    });

    this.ws.on("error", (error) => {
      console.error("Twitch EventSub WebSocket error:", error);
    });
  }

  private async handleMessage(message: TwitchEventSubMessage): Promise<void> {
    switch (message.metadata.message_type) {
      case "session_welcome":
        await this.handleSessionWelcome(message);
        break;
      case "session_keepalive":
        this.handleKeepalive(message);
        break;
      case "notification":
        await this.handleNotification(message);
        break;
      case "session_reconnect":
        this.handleReconnect(message);
        break;
      case "revocation":
        this.handleRevocation(message);
        break;
      default:
        console.log("Unknown Twitch EventSub message type:", message.metadata.message_type);
    }
  }

  private async handleSessionWelcome(message: TwitchEventSubMessage): Promise<void> {
    const session = message.payload.session;
    if (!session) return;

    this.sessionId = session.id;
    console.log(`Twitch EventSub session established: ${this.sessionId}`);

    // Set up keepalive timeout
    const keepaliveSeconds = session.keepalive_timeout_seconds;
    this.keepaliveTimeout = setTimeout(() => {
      console.warn("Twitch EventSub keepalive timeout exceeded");
      this.ws?.close();
    }, keepaliveSeconds * 1000 + 5000); // Add 5 second buffer

    // Subscribe to events after session is established
    await this.subscribeToEvents();
  }

  private handleKeepalive(message: TwitchEventSubMessage): void {
    console.log("Received Twitch EventSub keepalive");
    
    // Reset keepalive timeout
    if (this.keepaliveTimeout) {
      clearTimeout(this.keepaliveTimeout);
    }
    
    const session = message.payload.session;
    if (session) {
      const keepaliveSeconds = session.keepalive_timeout_seconds;
      this.keepaliveTimeout = setTimeout(() => {
        console.warn("Twitch EventSub keepalive timeout exceeded");
        this.ws?.close();
      }, keepaliveSeconds * 1000 + 5000);
    }
  }

  private async handleNotification(message: TwitchEventSubMessage): Promise<void> {
    const subscription = message.payload.subscription;
    const event = message.payload.event;
    
    if (!subscription || !event) return;

    console.log(`Received Twitch event: ${subscription.type}`, event);

    // Process the event and generate banter
    await this.processEvent(subscription.type, event);
  }

  private handleReconnect(message: TwitchEventSubMessage): void {
    const session = message.payload.session;
    if (session?.reconnect_url) {
      console.log("Twitch EventSub requesting reconnect");
      this.reconnectUrl = session.reconnect_url;
      this.ws?.close(1000); // Normal close to trigger reconnect
    }
  }

  private handleRevocation(message: TwitchEventSubMessage): void {
    const subscription = message.payload.subscription;
    console.log(`Twitch EventSub subscription revoked: ${subscription?.type}`);
  }

  private async subscribeToEvents(): Promise<void> {
    if (!this.sessionId) return;

    // Get current user info
    const userInfo = await this.getUserInfo();
    if (!userInfo?.id) {
      console.error("Could not get Twitch user info");
      return;
    }

    const subscriptions = [
      {
        type: "channel.chat.message",
        version: "1",
        condition: {
          broadcaster_user_id: userInfo.id,
          user_id: userInfo.id
        }
      },
      {
        type: "channel.subscribe",
        version: "1", 
        condition: {
          broadcaster_user_id: userInfo.id
        }
      },
      {
        type: "channel.cheer",
        version: "1",
        condition: {
          broadcaster_user_id: userInfo.id
        }
      },
      {
        type: "channel.raid",
        version: "1",
        condition: {
          to_broadcaster_user_id: userInfo.id
        }
      },
      {
        type: "channel.follow",
        version: "2",
        condition: {
          broadcaster_user_id: userInfo.id,
          moderator_user_id: userInfo.id
        }
      }
    ];

    for (const sub of subscriptions) {
      try {
        await this.createSubscription(sub);
      } catch (error) {
        console.error(`Failed to create subscription for ${sub.type}:`, error);
      }
    }
  }

  private async createSubscription(subscription: any): Promise<void> {
    const response = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.accessToken}`,
        "Client-Id": this.clientId,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ...subscription,
        transport: {
          method: "websocket",
          session_id: this.sessionId
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create subscription: ${response.status} ${error}`);
    }

    const result = await response.json();
    console.log(`Created Twitch subscription: ${subscription.type}`, result);
  }

  private async getUserInfo(): Promise<any> {
    const response = await fetch("https://api.twitch.tv/helix/users", {
      headers: {
        "Authorization": `Bearer ${this.accessToken}`,
        "Client-Id": this.clientId
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.status}`);
    }

    const result = await response.json();
    return result.data?.[0];
  }

  private async processEvent(eventType: string, event: any): Promise<void> {
    try {
      let originalMessage = "";
      let eventData: any = {};

      switch (eventType) {
        case "channel.chat.message":
          originalMessage = event.message.text;
          eventData = {
            username: event.chatter_user_name,
            messageId: event.message_id
          };
          break;

        case "channel.subscribe":
          originalMessage = `${event.user_name} just subscribed!`;
          eventData = {
            username: event.user_name,
            tier: event.tier,
            isGift: event.is_gift
          };
          break;

        case "channel.cheer":
          originalMessage = `${event.user_name} cheered ${event.bits} bits!`;
          eventData = {
            username: event.user_name,
            bits: event.bits,
            message: event.message
          };
          break;

        case "channel.raid":
          originalMessage = `${event.from_broadcaster_user_name} raided with ${event.viewers} viewers!`;
          eventData = {
            username: event.from_broadcaster_user_name,
            viewers: event.viewers
          };
          break;

        case "channel.follow":
          originalMessage = `${event.user_name} just followed!`;
          eventData = {
            username: event.user_name,
            followedAt: event.followed_at
          };
          break;

        default:
          console.log(`Unhandled event type: ${eventType}`);
          return;
      }

      // Create banter for the event
      await this.createBanterForEvent(originalMessage, eventType, eventData);

    } catch (error) {
      console.error("Error processing Twitch event:", error);
    }
  }

  private async createBanterForEvent(originalMessage: string, eventType: string, eventData: any): Promise<void> {
    try {
      // Find the user this event belongs to
      const userInfo = await this.getUserInfo();
      if (!userInfo?.id) {
        console.error("Could not get user info for banter generation");
        return;
      }

          // Get user from storage to find the actual BanterBox user ID
    const twitchSettings = await firebaseStorage.getTwitchSettings(userInfo.id);
      if (!twitchSettings) {
        console.error("No Twitch settings found for user");
        return;
      }

      // Generate banter using the existing system
      await this.generateAndBroadcastBanter(twitchSettings.userId, originalMessage, eventType as any, eventData);
    } catch (error) {
      console.error("Error creating banter for Twitch event:", error);
    }
  }

  private async generateAndBroadcastBanter(userId: string, originalMessage: string, eventType: any, eventData: any): Promise<void> {
    // This will be injected by the routes system to connect to the existing banter generation
    if (this.onBanterGenerated) {
      await this.onBanterGenerated(userId, originalMessage, eventType, eventData);
    }
  }

  private onBanterGenerated?: (userId: string, originalMessage: string, eventType: any, eventData: any) => Promise<void>;

  // Method to inject the banter generation callback
  setBanterGenerationCallback(callback: (userId: string, originalMessage: string, eventType: any, eventData: any) => Promise<void>) {
    this.onBanterGenerated = callback;
  }

  private attemptReconnect(): void {
    if (this.isReconnecting) return;
    
    this.isReconnecting = true;
    console.log("Attempting to reconnect to Twitch EventSub...");
    
    setTimeout(() => {
      this.isReconnecting = false;
      this.connect().catch(error => {
        console.error("Failed to reconnect to Twitch EventSub:", error);
        // Try again after a longer delay
        setTimeout(() => this.attemptReconnect(), 30000);
      });
    }, 5000);
  }

  disconnect(): void {
    console.log("Disconnecting from Twitch EventSub");
    
    if (this.keepaliveTimeout) {
      clearTimeout(this.keepaliveTimeout);
      this.keepaliveTimeout = null;
    }
    
    if (this.ws) {
      this.ws.close(1000); // Normal closure
      this.ws = null;
    }
    
    this.sessionId = null;
    this.reconnectUrl = null;
  }
}

export default TwitchEventSubClient;