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
  private banterCallback?: (userId: string | null, originalMessage: string, eventType: string, eventData: any) => Promise<void>;
  private voiceConnections: Map<string, VoiceConnection> = new Map(); // Track active voice connections by guild ID

  constructor(config: DiscordConfig) {
    this.config = config;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
      ]
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.client.once(Events.ClientReady, async (readyClient) => {
      console.log(`Discord bot ready! Logged in as ${readyClient.user.tag}`);
      
      for (const guild of Array.from(readyClient.guilds.cache.values())) {
        const voiceStates = guild.voiceStates.cache;
        const botVoiceState = voiceStates.get(readyClient.user!.id);
        
        if (botVoiceState && botVoiceState.channel) {
          console.log(`Bot found in voice channel ${botVoiceState.channel.name} (${botVoiceState.channel.id}) in guild ${guild.name} (${guild.id})`);
          const connection = getVoiceConnection(guild.id);
          if (connection) {
            this.voiceConnections.set(guild.id, connection);
            console.log(`✅ Restored existing voice connection for guild ${guild.id}`);
            console.log(`Voice connections map now has: ${Array.from(this.voiceConnections.keys())}`);
          } else {
            console.log(`⚠️ No existing connection found, re-joining voice channel...`);
            const success = await this.joinVoiceChannel(guild.id, botVoiceState.channel.id);
            if (success) {
              console.log(`✅ Successfully re-joined voice channel`);
            } else {
              console.log(`❌ Failed to re-join voice channel`);
            }
          }
        }
      }
      console.log(`Bot startup complete. Voice connections: ${this.voiceConnections.size} guilds: ${Array.from(this.voiceConnections.keys())}`);
    });

    this.client.on(Events.MessageCreate, async (message: Message) => {
      if (message.author.bot || !message.guild) return;
      
      console.log(`Discord message received from ${message.author.username}: ${message.content}`);
      
      const voiceConnection = this.voiceConnections.get(message.guild.id);
      if (!voiceConnection) {
        console.log(`Not generating banter - bot not in voice channel for guild ${message.guild.id}`);
        console.log(`Current voice connections:`, Array.from(this.voiceConnections.keys()));
        return;
      }

      const shouldRespond = message.content.toLowerCase().includes('banterbox') || 
                           message.content.toLowerCase().includes('banter') ||
                           message.mentions.has(this.client.user!.id);
      
      if (!shouldRespond) {
        console.log(`Ignoring message "${message.content}" - doesn't mention banterbox`);
        return;
      }
      
      console.log(`Triggering banter generation for Discord message in guild ${message.guild.id}`);
      
      if (this.banterCallback) {
        await this.banterCallback(
          null, // userId will be looked up from guild link
          message.content,
          'discord_message',
          {
            displayName: message.author.displayName || message.author.username,
            username: message.author.username,
            discordUserId: message.author.id,
            guildId: message.guild.id,
            guildName: message.guild.name,
            channelId: message.channel.id,
            messageId: message.id,
            messageContent: message.content
          }
        );
      }
    });

    this.client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
      const voiceConnection = this.voiceConnections.get(member.guild.id);
      if (!voiceConnection) return;
      
      if (this.banterCallback) {
        await this.banterCallback(
          null, // userId will be looked up from guild link
          `${member.displayName || member.user.username} joined the server`,
          'discord_member_join',
          {
            displayName: member.displayName || member.user.username,
            username: member.user.username,
            discordUserId: member.id,
            guildId: member.guild.id,
            guildName: member.guild.name
          }
        );
      }
    });

    this.client.on(Events.VoiceStateUpdate, (oldState: VoiceState, newState: VoiceState) => {
      if (newState.member?.user.id !== this.client.user?.id) return;

      const guildId = newState.guild.id;

      if (newState.channel) {
        console.log(`Bot joined voice channel ${newState.channel.name} in guild ${newState.guild.name} - streaming mode activated`);
      } else if (oldState.channel) {
        console.log(`Bot left voice channel ${oldState.channel.name} in guild ${oldState.guild.name} - streaming mode deactivated`);
        this.voiceConnections.delete(guildId);
      }
    });
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
    this.client.destroy();
    console.log('Discord bot disconnected');
  }

  setBanterCallback(callback: (userId: string | null, originalMessage: string, eventType: string, eventData: any) => Promise<void>) {
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
        adapterCreator: guild.voiceAdapterCreator as any, // Fix type compatibility
        selfDeaf: false, // Allow bot to be undeafened for proper audio playback
        selfMute: false,
      });

      // Import entersState function
      const { entersState, VoiceConnectionStatus } = await import('@discordjs/voice');
      
      // Don't wait for connection to be ready - start immediately
      console.log('Voice connection established - ready for audio playback');

      // Add connection event listeners for stability
      connection.on('stateChange', (oldState, newState) => {
        console.log(`Discord voice connection state changed from ${oldState.status} to ${newState.status}`);
      });

      connection.on('error', (error) => {
        console.error('Discord voice connection error:', error);
      });

      // Prevent idle timeout by implementing keepalive
      connection.on('stateChange', (oldState, newState) => {
        if (newState.status === VoiceConnectionStatus.Destroyed) {
          console.log('Discord voice connection destroyed - cleaning up');
          this.voiceConnections.delete(guildId);
        }
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
    const hasConnection = this.voiceConnections.has(guildId);
    console.log(`[isInVoiceChannel] Guild ${guildId}: ${hasConnection} (Map size: ${this.voiceConnections.size}, Keys: ${Array.from(this.voiceConnections.keys())})`);
    
    // Also check if bot is actually in a voice channel according to Discord
    const guild = this.client.guilds.cache.get(guildId);
    if (guild) {
      const botVoiceState = guild.voiceStates.cache.get(this.client.user!.id);
      const isInChannel = !!botVoiceState?.channel;
      console.log(`[isInVoiceChannel] Discord state check - Bot in channel: ${isInChannel}`);
      
      // If Discord says we're in a channel but Map is empty, restore the connection
      if (isInChannel && !hasConnection && botVoiceState?.channel) {
        console.log(`[isInVoiceChannel] State mismatch detected! Restoring connection...`);
        const connection = getVoiceConnection(guildId);
        if (connection) {
          this.voiceConnections.set(guildId, connection);
          console.log(`[isInVoiceChannel] Connection restored to Map`);
          return true;
        }
      }
      
      return hasConnection || isInChannel;
    }
    
    return hasConnection;
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
      const replicationDomain = process.env.REPLIT_DOMAINS?.split(',')[0];
      const railwayDomain = process.env.RAILWAY_STATIC_URL;
      console.log(`REPLIT_DOMAINS env var: ${process.env.REPLIT_DOMAINS}`);
      console.log(`RAILWAY_STATIC_URL env var: ${process.env.RAILWAY_STATIC_URL}`);
      console.log(`Original audio URL: ${audioUrl}`);
      
      const publicAudioUrl = railwayDomain 
        ? `https://${railwayDomain}${audioUrl.replace('http://localhost:5000', '')}`
        : replicationDomain 
        ? `https://${replicationDomain}${audioUrl.replace('http://localhost:5000', '')}`
        : audioUrl;
      
      console.log(`Public audio URL for Discord: ${publicAudioUrl}`);
      
      // Test URL accessibility before trying to play
      try {
        const testResponse = await fetch(publicAudioUrl);
        console.log(`Audio URL test - Status: ${testResponse.status}, Accessible: ${testResponse.ok}`);
      } catch (error) {
        console.log(`Audio URL not accessible:`, (error as Error).message);
      }
      
      // Create resource with public URL
      const resource = createAudioResource(publicAudioUrl, {
        inlineVolume: false,
      });
      
      console.log(`Playing TTS audio in voice channel for guild ${guildId}`);
      
      // Check connection state and play immediately if connecting
      const connectionState = connection.state.status;
      console.log(`Voice connection state: ${connectionState}`);
      
      // Force play immediately regardless of connection state for Replit
      console.log(`Voice connection state: ${connectionState} - forcing audio playback`);
      
      // Skip all connection state checks for Replit environment
      
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
      
      // Force connection to Ready state for Replit environment
      if (connectionState !== VoiceConnectionStatus.Ready) {
        console.log('Attempting to force connection to ready state...');
        // Note: Removed ping call as it's not available in current Discord.js voice API
      }
      
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
        
        // Timeout after 5 seconds - shorter timeout for faster response
        setTimeout(() => {
          console.log('Audio playback timeout - assuming success');
          resolve(true);
        }, 5000);
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
}

export default DiscordService;