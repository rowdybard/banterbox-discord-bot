import { Client, GatewayIntentBits, Events, Message, GuildMember, VoiceState } from 'discord.js';
import { joinVoiceChannel, VoiceConnection, getVoiceConnection } from '@discordjs/voice';

interface DiscordConfig {
  token: string;
  clientId: string;
  clientSecret: string;
}

export class DiscordService {
  private client: Client;
  private config: DiscordConfig;
  private banterCallback?: (userId: string, originalMessage: string, eventType: string, eventData: any) => Promise<void>;
  private voiceConnections: Map<string, VoiceConnection> = new Map(); // Track active voice connections by guild ID
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 5000;
  private heartbeatInterval?: NodeJS.Timeout;
  private isReconnecting: boolean = false;
  
  // Auto-reconnect protection
  private voiceChannelMemory: Map<string, string> = new Map(); // guildId -> channelId
  private autoReconnectEnabled: boolean = true;
  private autoReconnectInterval?: NodeJS.Timeout;
  private maxAutoReconnectAttempts: number = 3;
  private autoReconnectAttempts: Map<string, number> = new Map(); // guildId -> attempts

  constructor(config: DiscordConfig) {
    this.config = config;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
      ],
      // Add connection stability options
      ws: {
        properties: {
          browser: 'Discord iOS'
        }
      }
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    // Handle client ready event
    this.client.once(Events.ClientReady, async (readyClient) => {
      console.log(`Discord bot ready! Logged in as ${readyClient.user.tag}`);
      this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
      this.isReconnecting = false;
      
      // Start heartbeat to keep connection alive
      this.startHeartbeat();
      
      // Check if bot is already in any voice channels (from previous session)
      for (const guild of Array.from(readyClient.guilds.cache.values())) {
        const voiceStates = guild.voiceStates.cache;
        const botVoiceState = voiceStates.get(readyClient.user!.id);
        
        if (botVoiceState && botVoiceState.channel) {
          // Bot is already in a voice channel in this guild
          const connection = getVoiceConnection(guild.id);
          if (connection) {
            this.voiceConnections.set(guild.id, connection);
            console.log(`Bot already in voice channel ${botVoiceState.channel.name} in guild ${guild.name} - restored connection`);
          } else {
            // Re-establish the connection
            console.log(`Re-joining voice channel ${botVoiceState.channel.name} in guild ${guild.name}`);
            await this.joinVoiceChannel(guild.id, botVoiceState.channel.id);
          }
        }
      }
    });

    // Handle disconnection events
    this.client.on(Events.Disconnect, (event) => {
      console.log(`Discord bot disconnected: ${event.reason} (code: ${event.code})`);
      this.stopHeartbeat();
      this.attemptReconnect();
    });

    this.client.on(Events.Error, (error) => {
      console.error('Discord bot error:', error);
      // Don't immediately reconnect on error - let the disconnect event handle it
    });

    this.client.on(Events.Warn, (warning) => {
      console.warn('Discord bot warning:', warning);
    });

    // Handle Discord messages for banter generation
    this.client.on(Events.MessageCreate, async (message: Message) => {
      try {
        // Ignore bot messages and system messages
        if (message.author.bot || !message.guild) return;
        
        console.log(`Discord message received from ${message.author.username}: ${message.content}`);
        
        // Check if bot is in a voice channel in this guild (streaming mode)
        const voiceConnection = this.voiceConnections.get(message.guild.id);
        const isStreamingMode = !!voiceConnection;
        
        // Determine if we should respond to this message
        let shouldRespond = false;
        let responseReason = '';
        
        // Always respond to direct mentions
        if (message.mentions.has(this.client.user!.id)) {
          shouldRespond = true;
          responseReason = 'direct mention';
        }
        // Respond to messages containing banterbox/banter keywords
        else if (message.content.toLowerCase().includes('banterbox') || 
                 message.content.toLowerCase().includes('banter')) {
          shouldRespond = true;
          responseReason = 'keyword trigger';
        }
        // In streaming mode, respond to more messages for better engagement
        else if (isStreamingMode) {
          // Respond to questions, greetings, and conversational messages
          const content = message.content.toLowerCase();
          const isQuestion = content.includes('?') || content.startsWith('what') || content.startsWith('how') || content.startsWith('why');
          const isGreeting = content.includes('hello') || content.includes('hi') || content.includes('hey') || content.includes('sup');
          const isConversational = content.length > 10 && (content.includes('you') || content.includes('think') || content.includes('feel'));
          
          if (isQuestion || isGreeting || isConversational) {
            shouldRespond = true;
            responseReason = 'conversational trigger';
          }
        }
        // Even when not in streaming mode, respond to direct questions and greetings
        else {
          const content = message.content.toLowerCase();
          const isDirectQuestion = content.includes('?') && (content.includes('banterbox') || content.includes('you'));
          const isDirectGreeting = (content.includes('hello') || content.includes('hi') || content.includes('hey')) && 
                                  (content.includes('banterbox') || content.includes('bot'));
          
          if (isDirectQuestion || isDirectGreeting) {
            shouldRespond = true;
            responseReason = 'direct interaction';
          }
        }
        
        if (!shouldRespond) {
          console.log(`Ignoring message "${message.content}" - no trigger conditions met`);
          return;
        }
        
        console.log(`Triggering banter generation for Discord message (${responseReason}) in guild ${message.guild.id}`);
        
        // Trigger banter generation if callback is set
        if (this.banterCallback) {
          await this.banterCallback(
            message.author.id,
            message.content,
            'discord_message',
            {
              displayName: message.author.displayName || message.author.username,
              guildId: message.guild.id,
              guildName: message.guild.name,
              channelId: message.channel.id,
              messageId: message.id,
              messageContent: message.content,
              isStreamingMode: isStreamingMode,
              responseReason: responseReason
            }
          );
        }
      } catch (error) {
        console.error('Error handling Discord message:', error);
      }
    });

    this.client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
      try {
        // Check if bot is in a voice channel in this guild
        const voiceConnection = this.voiceConnections.get(member.guild.id);
        if (!voiceConnection) return;
        
        if (this.banterCallback) {
          await this.banterCallback(
            member.id,
            `${member.displayName || member.user.username} joined the server`,
            'discord_member_join',
            {
              displayName: member.displayName || member.user.username,
              guildId: member.guild.id,
              guildName: member.guild.name
            }
          );
        }
      } catch (error) {
        console.error('Error handling guild member add:', error);
      }
    });

    // Handle voice state updates to track when bot joins/leaves voice channels
    this.client.on(Events.VoiceStateUpdate, (oldState: VoiceState, newState: VoiceState) => {
      try {
        // Check if it's our bot
        if (newState.member?.user.id !== this.client.user?.id) return;

        const guildId = newState.guild.id;

        if (newState.channel) {
          // Bot joined a voice channel
          console.log(`Bot joined voice channel ${newState.channel.name} in guild ${newState.guild.name} - streaming mode activated`);
          // Remember this channel for auto-reconnect
          this.voiceChannelMemory.set(guildId, newState.channel.id);
          this.autoReconnectAttempts.delete(guildId); // Reset attempts on successful join
        } else if (oldState.channel) {
          // Bot left a voice channel
          console.log(`Bot left voice channel ${oldState.channel.name} in guild ${newState.guild.name} - streaming mode deactivated`);
          this.voiceConnections.delete(guildId);
          
          // Check if this was an unexpected disconnect (not manual leave)
          if (this.autoReconnectEnabled && this.voiceChannelMemory.has(guildId)) {
            console.log(`Unexpected voice disconnect detected for guild ${guildId}, will attempt auto-reconnect`);
            this.scheduleAutoReconnect(guildId);
          }
        }
      } catch (error) {
        console.error('Error handling voice state update:', error);
      }
    });

    // Handle when bot is removed from a guild
    this.client.on(Events.GuildDelete, async (guild) => {
      try {
        console.log(`Bot was removed from guild: ${guild.name} (${guild.id})`);
        
        // Clean up voice connections
        this.voiceConnections.delete(guild.id);
        
        // Import storage to clean up guild data
        const { storage } = await import('./storage');
        
        try {
          // Deactivate guild link
          await storage.deactivateGuildLink(guild.id);
          console.log(`Deactivated guild link for ${guild.name}`);
          
          // Clear any active streamer session
          await storage.clearCurrentStreamer(guild.id);
          console.log(`Cleared streaming session for ${guild.name}`);
          
          // Note: We don't delete guild settings/banters as user might re-add the bot
        } catch (error) {
          console.error(`Error cleaning up guild data for ${guild.name}:`, error);
        }
      } catch (error) {
        console.error('Error handling guild delete:', error);
      }
    });

    // Handle when bot joins a new guild
    this.client.on(Events.GuildCreate, async (guild) => {
      try {
        console.log(`Bot added to new guild: ${guild.name} (${guild.id})`);
        console.log(`Guild has ${guild.memberCount} members`);
      } catch (error) {
        console.error('Error handling guild create:', error);
      }
    });
  }

  private startHeartbeat() {
    // Clear any existing heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Monitor connection health every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      try {
        if (this.client.isReady()) {
          // Check if client is still healthy (doesn't need manual ping in modern Discord.js)
          const ping = this.client.ws.ping;
          console.log(`Discord heartbeat check - connection healthy (ping: ${ping}ms)`); // Fixed heartbeat error
          
          // Check for orphaned voice connections (connection exists but bot not in channel)
          this.checkOrphanedVoiceConnections();
        } else {
          console.warn('Discord client not ready during heartbeat check');
        }
      } catch (error) {
        console.error('Error during Discord heartbeat check:', error);
      }
    }, 30000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }

  private stopAutoReconnect() {
    if (this.autoReconnectInterval) {
      clearInterval(this.autoReconnectInterval);
      this.autoReconnectInterval = undefined;
    }
  }

  private async attemptReconnect() {
    if (this.isReconnecting) {
      console.log('Already attempting to reconnect, skipping...');
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`Max reconnection attempts (${this.maxReconnectAttempts}) reached. Stopping reconnection attempts.`);
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    console.log(`Attempting to reconnect Discord bot (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    try {
      // Wait before attempting reconnection
      await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));
      
      // Attempt to reconnect
      await this.connect();
      console.log('Discord bot reconnected successfully');
    } catch (error) {
      console.error(`Reconnection attempt ${this.reconnectAttempts} failed:`, error);
      this.isReconnecting = false;
      
      // Try again with exponential backoff
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
      setTimeout(() => this.attemptReconnect(), this.reconnectDelay);
    }
  }

  async connect() {
    try {
      await this.client.login(this.config.token);
      console.log('Discord bot connected successfully');
    } catch (error) {
      console.error('Failed to connect Discord bot:', error);
      throw error;
    }
  }

  disconnect() {
    this.stopHeartbeat();
    this.stopAutoReconnect();
    this.voiceChannelMemory.clear();
    this.autoReconnectAttempts.clear();
    this.client.destroy();
    console.log('Discord bot disconnected');
  }

  setBanterCallback(callback: (userId: string, originalMessage: string, eventType: string, eventData: any) => Promise<void>) {
    this.banterCallback = callback;
  }

  // Join a voice channel for streaming
  async joinVoiceChannel(guildId: string, channelId: string): Promise<boolean> {
    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) {
        console.error(`Guild ${guildId} not found`);
        return false;
      }

      const voiceChannel = guild.channels.cache.get(channelId);
      if (!voiceChannel || !voiceChannel.isVoiceBased()) {
        console.error(`Voice channel ${channelId} not found or not voice-based`);
        return false;
      }

      const connection = joinVoiceChannel({
        channelId: channelId,
        guildId: guildId,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false, // Allow bot to be undeafened for proper audio playback
        selfMute: false,
      });

      // Import entersState function
      const { entersState, VoiceConnectionStatus } = await import('@discordjs/voice');
      
      // Wait for connection to be ready with timeout
      try {
        await entersState(connection, VoiceConnectionStatus.Ready, 10000);
        console.log('Voice connection ready for audio playback');
      } catch (timeoutError) {
        console.warn('Voice connection timeout, but continuing anyway:', timeoutError);
      }

      // Add connection event listeners for stability
      connection.on('stateChange', (oldState, newState) => {
        console.log(`Discord voice connection state changed from ${oldState.status} to ${newState.status}`);
        
        // Handle connection destruction
        if (newState.status === VoiceConnectionStatus.Destroyed) {
          console.log('Discord voice connection destroyed - cleaning up');
          this.voiceConnections.delete(guildId);
        }
      });

      connection.on('error', (error) => {
        console.error('Discord voice connection error:', error);
        // Don't immediately destroy connection on error - let it try to recover
      });

      this.voiceConnections.set(guildId, connection);
      console.log(`Bot joined voice channel ${voiceChannel.name} in guild ${guild.name} - streaming mode activated`);
      console.log(`Voice connections map now contains ${this.voiceConnections.size} entries for guilds: ${Array.from(this.voiceConnections.keys())}`);
      return true;
    } catch (error) {
      console.error('Error joining voice channel:', error);
      return false;
    }
  }

  // Leave voice channel
  async leaveVoiceChannel(guildId: string): Promise<boolean> {
    try {
      const connection = getVoiceConnection(guildId);
      if (connection) {
        connection.destroy();
        this.voiceConnections.delete(guildId);
        // Clear auto-reconnect memory when manually leaving
        this.voiceChannelMemory.delete(guildId);
        this.autoReconnectAttempts.delete(guildId);
        console.log(`Bot left voice channel in guild ${guildId}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error leaving voice channel:', error);
      return false;
    }
  }

  // Check if bot is in voice channel (streaming mode)
  isInVoiceChannel(guildId: string): boolean {
    return this.voiceConnections.has(guildId);
  }

  // Play TTS audio in voice channel
  async playAudioInVoiceChannel(guildId: string, audioUrl: string): Promise<boolean> {
    try {
      const connection = this.voiceConnections.get(guildId);
      if (!connection) {
        console.log('No voice connection found for guild', guildId);
        return false;
      }

      // Import voice modules dynamically
      const { createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState } = await import('@discordjs/voice');
      
      // Create audio resource with more compatible settings for Replit
      console.log(`Creating audio resource from: ${audioUrl}`);
      
      // URL conversion and testing is now done below
      
      // Import the NoSubscriberBehavior enum
      const { NoSubscriberBehavior } = await import('@discordjs/voice');
      
      // Create audio player with better error handling
      const player = createAudioPlayer({
        behaviors: {
          noSubscriber: NoSubscriberBehavior.Play, // Force play even if no subscribers initially
          maxMissedFrames: Math.round(5000 / 20), // 5 seconds
        },
      });
      
      // Convert localhost URL to public URL for Discord access
      const renderDomain = process.env.RENDER_EXTERNAL_HOSTNAME;
      console.log(`RENDER_EXTERNAL_HOSTNAME env var: ${process.env.RENDER_EXTERNAL_HOSTNAME}`);
      console.log(`Original audio URL: ${audioUrl}`);
      
      // Handle different audio URL types
      let publicAudioUrl: string;
      
      if (audioUrl.startsWith('https://storage.googleapis.com/')) {
        // Firebase/GCS URLs are already public
        publicAudioUrl = audioUrl;
        console.log(`Using Firebase audio URL: ${publicAudioUrl}`);
      } else if (audioUrl.startsWith('/public-objects/')) {
        // Local object storage - convert to public URL
        publicAudioUrl = renderDomain 
          ? `https://${renderDomain}${audioUrl}`
          : `http://localhost:5000${audioUrl}`;
        console.log(`Using local storage audio URL: ${publicAudioUrl}`);
      } else {
        // Fallback for other URL formats
        publicAudioUrl = audioUrl;
        console.log(`Using original audio URL: ${publicAudioUrl}`);
      }
      
      console.log(`Public audio URL for Discord: ${publicAudioUrl}`);
      
      // Test URL accessibility before trying to play
      try {
        const testResponse = await fetch(publicAudioUrl);
        console.log(`Audio URL test - Status: ${testResponse.status}, Accessible: ${testResponse.ok}`);
      } catch (error) {
        console.log(`Audio URL not accessible:`, error.message);
      }
      
      // Create resource with public URL
      const resource = createAudioResource(publicAudioUrl, {
        inlineVolume: false,
      });
      
      console.log(`Playing TTS audio in voice channel for guild ${guildId}`);
      
      // Check connection state and play immediately if connecting
      const connectionState = connection.state.status;
      console.log(`Voice connection state: ${connectionState}`);
      
      // Wait for connection to be ready if it's not already
      if (connectionState !== VoiceConnectionStatus.Ready) {
        console.log('Waiting for voice connection to be ready...');
        try {
          await entersState(connection, VoiceConnectionStatus.Ready, 5000);
          console.log('Voice connection is now ready');
        } catch (timeoutError) {
          console.warn('Voice connection not ready, but attempting playback anyway:', timeoutError);
        }
      }
      
      // Play the audio with enhanced logging
      console.log('Starting audio playback...');
      player.play(resource);
      
      const subscription = connection.subscribe(player);
      if (!subscription) {
        console.log('Failed to subscribe audio player to voice connection');
        return false;
      }
      
      console.log('Audio player subscribed successfully');
      
      // Add detailed player event logging
      player.on('stateChange', (oldState, newState) => {
        console.log(`Audio player state: ${oldState.status} -> ${newState.status}`);
      });
      
      // Wait for playback to finish
      return new Promise((resolve) => {
        player.on(AudioPlayerStatus.Idle, () => {
          console.log('Audio playback finished');
          resolve(true);
        });
        
        player.on('error', (error) => {
          console.error('Audio playback error:', error);
          resolve(false);
        });
        
        // Timeout after 10 seconds - longer timeout for more reliable audio
        setTimeout(() => {
          console.log('Audio playback timeout - assuming success');
          resolve(true);
        }, 10000);
      });
    } catch (error) {
      console.error('Error playing audio in voice channel:', error);
      return false;
    }
  }

  // Get list of voice channels in a guild
  async getVoiceChannels(guildId: string) {
    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) return [];

      return guild.channels.cache
        .filter(channel => channel.isVoiceBased())
        .map(channel => ({
          id: channel.id,
          name: channel.name,
          type: channel.type
        }));
    } catch (error) {
      console.error('Error getting voice channels:', error);
      return [];
    }
  }

  // Send a message to a specific channel
  async sendMessage(channelId: string, message: string) {
    try {
      const channel = await this.client.channels.fetch(channelId);
      if (channel && 'send' in channel) {
        await channel.send(message);
      }
    } catch (error) {
      console.error('Error sending Discord message:', error);
    }
  }

  // Check if bot is actually in a guild (not just stored state)
  isActuallyInGuild(guildId: string): boolean {
    return this.client.guilds.cache.has(guildId);
  }

  // Get all guilds bot is currently in
  getCurrentGuilds() {
    return Array.from(this.client.guilds.cache.values()).map(guild => ({
      id: guild.id,
      name: guild.name,
      memberCount: guild.memberCount,
      iconURL: guild.iconURL()
    }));
  }

  // Sync guild links with actual bot presence
  async syncGuildLinks() {
    const { storage } = await import('./storage');
    const currentGuilds = new Set(this.client.guilds.cache.keys());
    
    // This would need to be implemented to get all active guild links
    // For now, we'll handle this on a per-request basis
    console.log(`Bot is currently in ${currentGuilds.size} guilds`);
  }

  // Get bot's invite link
  getInviteLink(): string {
    const permissions = [
      'ViewChannel',
      'SendMessages',
      'ReadMessageHistory',
      'AddReactions',
      'UseSlashCommands'
    ];
    
    return `https://discord.com/api/oauth2/authorize?client_id=${this.config.clientId}&permissions=2147534848&scope=bot%20applications.commands`;
  }

  // Check connection health
  isHealthy(): boolean {
    return this.client.isReady() && !this.isReconnecting;
  }

  // Get connection status
  getConnectionStatus() {
    return {
      isReady: this.client.isReady(),
      isReconnecting: this.isReconnecting,
      reconnectAttempts: this.reconnectAttempts,
      voiceConnections: this.voiceConnections.size,
      guilds: this.client.guilds.cache.size,
      autoReconnectEnabled: this.autoReconnectEnabled,
      voiceChannelMemory: this.voiceChannelMemory.size
    };
  }

  // Auto-reconnect protection methods

  /**
   * Schedule auto-reconnect for a specific guild
   */
  private scheduleAutoReconnect(guildId: string) {
    const attempts = this.autoReconnectAttempts.get(guildId) || 0;
    
    if (attempts >= this.maxAutoReconnectAttempts) {
      console.log(`Max auto-reconnect attempts (${this.maxAutoReconnectAttempts}) reached for guild ${guildId}`);
      this.voiceChannelMemory.delete(guildId);
      this.autoReconnectAttempts.delete(guildId);
      return;
    }

    const delay = Math.min(5000 * Math.pow(2, attempts), 30000); // Exponential backoff: 5s, 10s, 20s, 30s
    console.log(`Scheduling auto-reconnect for guild ${guildId} in ${delay}ms (attempt ${attempts + 1}/${this.maxAutoReconnectAttempts})`);
    
    setTimeout(() => {
      this.attemptAutoReconnect(guildId);
    }, delay);
  }

  /**
   * Attempt to auto-reconnect to a voice channel
   */
  private async attemptAutoReconnect(guildId: string) {
    try {
      const channelId = this.voiceChannelMemory.get(guildId);
      if (!channelId) {
        console.log(`No voice channel memory for guild ${guildId}, skipping auto-reconnect`);
        return;
      }

      const attempts = this.autoReconnectAttempts.get(guildId) || 0;
      this.autoReconnectAttempts.set(guildId, attempts + 1);

      console.log(`Attempting auto-reconnect to voice channel ${channelId} in guild ${guildId} (attempt ${attempts + 1}/${this.maxAutoReconnectAttempts})`);

      // Check if bot is already in a voice channel
      if (this.isInVoiceChannel(guildId)) {
        console.log(`Bot already in voice channel for guild ${guildId}, skipping auto-reconnect`);
        this.autoReconnectAttempts.delete(guildId);
        return;
      }

      // Check if the channel still exists and bot has permission
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) {
        console.log(`Guild ${guildId} not found, removing from auto-reconnect memory`);
        this.voiceChannelMemory.delete(guildId);
        this.autoReconnectAttempts.delete(guildId);
        return;
      }

      const channel = guild.channels.cache.get(channelId);
      if (!channel || !channel.isVoiceBased()) {
        console.log(`Voice channel ${channelId} not found or not voice-based, removing from auto-reconnect memory`);
        this.voiceChannelMemory.delete(guildId);
        this.autoReconnectAttempts.delete(guildId);
        return;
      }

      // Check bot permissions
      const botMember = guild.members.cache.get(this.client.user!.id);
      if (!botMember || !channel.permissionsFor(botMember).has('Connect')) {
        console.log(`Bot doesn't have permission to connect to channel ${channelId}, removing from auto-reconnect memory`);
        this.voiceChannelMemory.delete(guildId);
        this.autoReconnectAttempts.delete(guildId);
        return;
      }

      // Attempt to join the voice channel
      const success = await this.joinVoiceChannel(guildId, channelId);
      
      if (success) {
        console.log(`✅ Auto-reconnect successful for guild ${guildId}`);
        this.autoReconnectAttempts.delete(guildId);
      } else {
        console.log(`❌ Auto-reconnect failed for guild ${guildId}, will retry if attempts remain`);
        if (attempts + 1 < this.maxAutoReconnectAttempts) {
          this.scheduleAutoReconnect(guildId);
        } else {
          console.log(`Max auto-reconnect attempts reached for guild ${guildId}, giving up`);
          this.voiceChannelMemory.delete(guildId);
          this.autoReconnectAttempts.delete(guildId);
        }
      }
    } catch (error) {
      console.error(`Error during auto-reconnect for guild ${guildId}:`, error);
      const attempts = this.autoReconnectAttempts.get(guildId) || 0;
      if (attempts + 1 < this.maxAutoReconnectAttempts) {
        this.scheduleAutoReconnect(guildId);
      } else {
        console.log(`Max auto-reconnect attempts reached for guild ${guildId}, giving up`);
        this.voiceChannelMemory.delete(guildId);
        this.autoReconnectAttempts.delete(guildId);
      }
    }
  }

  /**
   * Check for orphaned voice connections (connection exists but bot not in channel)
   */
  private checkOrphanedVoiceConnections() {
    for (const [guildId, connection] of this.voiceConnections.entries()) {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) {
        console.log(`Guild ${guildId} not found, cleaning up orphaned voice connection`);
        this.voiceConnections.delete(guildId);
        continue;
      }

      const botVoiceState = guild.voiceStates.cache.get(this.client.user!.id);
      if (!botVoiceState || !botVoiceState.channel) {
        console.log(`Bot not in voice channel for guild ${guildId}, cleaning up orphaned connection`);
        this.voiceConnections.delete(guildId);
        connection.destroy();
        
        // Attempt auto-reconnect if we have memory of this channel
        if (this.autoReconnectEnabled && this.voiceChannelMemory.has(guildId)) {
          console.log(`Attempting auto-reconnect for orphaned connection in guild ${guildId}`);
          this.scheduleAutoReconnect(guildId);
        }
      }
    }
  }

  /**
   * Enable/disable auto-reconnect protection
   */
  setAutoReconnectEnabled(enabled: boolean) {
    this.autoReconnectEnabled = enabled;
    console.log(`Auto-reconnect protection ${enabled ? 'enabled' : 'disabled'}`);
    
    if (!enabled) {
      // Clear all auto-reconnect state
      this.voiceChannelMemory.clear();
      this.autoReconnectAttempts.clear();
      this.stopAutoReconnect();
    }
  }

  /**
   * Get auto-reconnect status for debugging
   */
  getAutoReconnectStatus() {
    return {
      enabled: this.autoReconnectEnabled,
      voiceChannelMemory: Array.from(this.voiceChannelMemory.entries()).map(([guildId, channelId]) => ({
        guildId,
        channelId
      })),
      autoReconnectAttempts: Array.from(this.autoReconnectAttempts.entries()).map(([guildId, attempts]) => ({
        guildId,
        attempts
      }))
    };
  }

  /**
   * Manually trigger auto-reconnect for a guild (for testing)
   */
  async triggerAutoReconnect(guildId: string) {
    if (!this.autoReconnectEnabled) {
      console.log('Auto-reconnect is disabled');
      return false;
    }

    const channelId = this.voiceChannelMemory.get(guildId);
    if (!channelId) {
      console.log(`No voice channel memory for guild ${guildId}`);
      return false;
    }

    console.log(`Manually triggering auto-reconnect for guild ${guildId}`);
    return await this.attemptAutoReconnect(guildId);
  }
}

export default DiscordService;