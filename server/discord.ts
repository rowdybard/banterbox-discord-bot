import { Client, GatewayIntentBits, Events, Message, GuildMember, VoiceState } from 'discord.js';
import {
  joinVoiceChannel,
  VoiceConnection,
  getVoiceConnection,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  VoiceConnectionStatus,
  StreamType,
} from '@discordjs/voice';
import ffmpeg from 'ffmpeg-static';
import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_TEST_MP3 = path.resolve(process.cwd(), 'test.mp3');

// Config the service expects at construction
interface DiscordConfig {
  token: string;
  clientId: string;
  clientSecret: string;
}

// --- Helpers ---------------------------------------------------------------

// If you pass a Firebase Storage *download* URL (has alt=media&token=...), use as-is.
// If you pass a public URL, also fine. We don't try to transform; just stream it.
function normalizeAudioUrl(url: string): string {
  return url;
}

function ffmpegPCMStream(url: string) {
  const args = ['-re','-i', url,'-analyzeduration','0','-loglevel','0','-f','s16le','-ar','48000','-ac','2','pipe:1'];
  const bin = (ffmpegPath ?? '') as unknown as string; // ← appease TS
  const child = spawn(bin, args, { stdio: ['ignore','pipe','ignore'] });
  return child.stdout!;
}

function makeResourceFromMp3(url: string) {
  const stream = ffmpegPCMStream(url);
  return createAudioResource(stream, { inputType: StreamType.Raw });
}

// --- Service ---------------------------------------------------------------

export class DiscordService {
  private client: Client;
  private config: DiscordConfig;
  private banterCallback?: (
    userId: string | null,
    originalMessage: string,
    eventType: string,
    eventData: any
  ) => Promise<void>;
  private voiceConnections: Map<string, VoiceConnection> = new Map();

  constructor(config: DiscordConfig) {
    this.config = config;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
      ],
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.client.once(Events.ClientReady, async (readyClient) => {
      console.log(`Discord bot ready! Logged in as ${readyClient.user.tag}`);

      // Restore voice connections if the bot was already in channels
      for (const guild of Array.from(readyClient.guilds.cache.values())) {
        const voiceStates = guild.voiceStates.cache;
        const botVoiceState = voiceStates.get(readyClient.user!.id);
        if (botVoiceState?.channel) {
          const connection = getVoiceConnection(guild.id);
          if (connection) {
            this.voiceConnections.set(guild.id, connection);
            console.log(`✅ Restored voice connection for guild ${guild.id}`);
          } else {
            console.log(`Re-joining voice channel ${botVoiceState.channel.name}…`);
            await this.joinVoiceChannel(guild.id, botVoiceState.channel.id);
          }
        }
      }
      console.log(`Startup complete. Tracked voice connections: ${this.voiceConnections.size}`);
    });

    this.client.on(Events.MessageCreate, async (message: Message) => {
      if (message.author.bot || !message.guild) return;

      const voiceConnection = this.voiceConnections.get(message.guild.id);
      if (!voiceConnection) {
        console.log(`Ignoring text — no voice connection for guild ${message.guild.id}`);
        return;
      }

      const shouldRespond =
        message.content.toLowerCase().includes('banterbox') ||
        message.content.toLowerCase().includes('banter') ||
        message.mentions.has(this.client.user!.id);

      if (!shouldRespond) return;

      console.log(`Triggering banter generation for guild ${message.guild.id}`);
      if (this.banterCallback) {
        await this.banterCallback(null, message.content, 'discord_message', {
          displayName: (message.author as any).displayName || message.author.username,
          username: message.author.username,
          discordUserId: message.author.id,
          guildId: message.guild.id,
          guildName: message.guild.name,
          channelId: message.channel.id,
          messageId: message.id,
          messageContent: message.content,
        });
      }
    });

    this.client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
      const voiceConnection = this.voiceConnections.get(member.guild.id);
      if (!voiceConnection) return;

      if (this.banterCallback) {
        await this.banterCallback(null, `${member.displayName || member.user.username} joined the server`, 'discord_member_join', {
          displayName: member.displayName || member.user.username,
          username: member.user.username,
          discordUserId: member.id,
          guildId: member.guild.id,
          guildName: member.guild.name,
        });
      }
    });

    this.client.on(Events.VoiceStateUpdate, (oldState: VoiceState, newState: VoiceState) => {
      if (newState.member?.user.id !== this.client.user?.id) return;
      const guildId = newState.guild.id;
      if (!newState.channel && oldState.channel) {
        this.voiceConnections.delete(guildId);
        console.log(`Left voice channel in guild ${newState.guild.name}`);
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

  setBanterCallback(
    callback: (userId: string | null, originalMessage: string, eventType: string, eventData: any) => Promise<void>
  ) {
    this.banterCallback = callback;
  }

  // Join a voice channel for streaming
  async joinVoiceChannel(guildId: string, channelId: string): Promise<boolean> {
    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) return false;

      const voiceChannel = guild.channels.cache.get(channelId);
      if (!voiceChannel || !voiceChannel.isVoiceBased()) return false;

      const connection = joinVoiceChannel({
        channelId,
        guildId,
        adapterCreator: (guild as any).voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false,
      });

      connection.on('stateChange', (o, n) => {
        console.log(`Voice connection: ${o.status} → ${n.status}`);
      });
      connection.on('error', (e) => console.error('Voice connection error:', e));

      this.voiceConnections.set(guildId, connection);
      console.log(`Joined voice channel ${(voiceChannel as any).name} in guild ${(guild as any).name}`);
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
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error leaving voice channel:', error);
      return false;
    }
  }

  isInVoiceChannel(guildId: string): boolean {
    const hasConnection = this.voiceConnections.has(guildId);
    const guild = this.client.guilds.cache.get(guildId);
    if (guild) {
      const botState = guild.voiceStates.cache.get(this.client.user!.id);
      return hasConnection || !!botState?.channel;
    }
    return hasConnection;
  }

  // Play a Firebase MP3 (or any MP3 URL) in the current voice channel
  async playAudioInVoiceChannel(guildId: string, audioUrl: string): Promise<boolean> {
    try {
      const connection = this.voiceConnections.get(guildId);
      if (!connection) {
        console.log('No voice connection for guild', guildId);
        return false;
      }

      const url = normalizeAudioUrl(audioUrl);
      console.log('Creating audio resource from URL:', url);

      const player = createAudioPlayer({
        behaviors: {
          noSubscriber: NoSubscriberBehavior.Play,
          maxMissedFrames: Math.round(5000 / 20),
        },
      });

      const resource = makeResourceFromMp3(url);
      player.play(resource);

      const sub = connection.subscribe(player);
      if (!sub) {
        console.log('Failed to subscribe player to connection');
        return false;
      }

      player.on('stateChange', (o, n) => {
        console.log(`Player: ${o.status} → ${n.status}`);
      });
      player.on('error', (e) => console.error('Audio playback error:', e));

      // Resolve when playback finishes (or after a short timeout)
      return new Promise((resolve) => {
        player.once(AudioPlayerStatus.Idle, () => resolve(true));
        setTimeout(() => resolve(true), 5000);
      });
    } catch (error) {
      console.error('Error playing audio:', error);
      return false;
    }
  }

  async getVoiceChannels(guildId: string) {
    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) return [];
      return guild.channels.cache
        .filter((c) => c.isVoiceBased())
        .map((c) => ({ id: c.id, name: (c as any).name, type: c.type }));
    } catch (error) {
      console.error('Error getting voice channels:', error);
      return [];
    }
  }

  async sendMessage(channelId: string, message: string) {
    try {
      const channel = await this.client.channels.fetch(channelId);
      if (channel && 'send' in channel) await (channel as any).send(message);
    } catch (error) {
      console.error('Error sending Discord message:', error);
    }
  }

  getInviteLink(): string {
    return `https://discord.com/api/oauth2/authorize?client_id=${this.config.clientId}&permissions=2147534848&scope=bot%20applications.commands`;
  }
}

export default DiscordService;
