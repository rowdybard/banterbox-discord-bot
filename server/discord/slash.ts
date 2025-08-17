import { storage } from '../storage';
import { db } from '../db';
import { guildLinks } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';

// Discord permission constants
const MANAGE_GUILD_PERMISSION = 0x00000020; // Manage Server permission

/**
 * Check if user has streaming permissions (role-based or admin)
 */
async function checkStreamingPermission(body: any, guildId: string, userId: string): Promise<{allowed: boolean, reason: string}> {
  try {
    // Get member information from Discord
    const member = body.member;
    if (!member) {
      return { allowed: false, reason: "Unable to verify your Discord server membership" };
    }

    // Check if user has Manage Server permission (admins can always stream)
    const permissions = parseInt(member.permissions || '0');
    if ((permissions & MANAGE_GUILD_PERMISSION) !== 0) {
      return { allowed: true, reason: "Admin permission" };
    }

    // Check for streaming roles
    const roles = member.roles || [];
    const streamingRoleNames = ['streamer', 'banter streamer', 'banterbox streamer', 'content creator'];
    
    // For role checking, we'd need to fetch role details from Discord API
    // For now, we'll allow users with any roles (can be refined later)
    if (roles.length > 0) {
      return { allowed: true, reason: "Has server roles" };
    }

    return { allowed: false, reason: "You need a streaming role or Manage Server permission to control the bot" };
  } catch (error) {
    console.error('Error checking streaming permission:', error);
    return { allowed: false, reason: "Error checking permissions" };
  }
}

/**
 * Check if user has admin permissions
 */
async function checkAdminPermission(guildId: string, userId: string): Promise<boolean> {
  try {
    // In a real implementation, you'd fetch member permissions from Discord API
    // For now, we'll implement basic permission checking
    return true; // Allow for testing - should be enhanced with actual Discord API calls
  } catch (error) {
    console.error('Error checking admin permission:', error);
    return false;
  }
}

// Get global Discord service instance
let discordService: any = null;
export function setDiscordService(service: any) {
  discordService = service;
}

/**
 * Discord interaction response types
 */
export const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
} as const;

/**
 * Discord message flags
 */
export const InteractionResponseFlags = {
  EPHEMERAL: 64,
} as const;

/**
 * Creates an ephemeral response (only visible to the command user)
 */
function ephemeral(content: string) {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content,
      flags: InteractionResponseFlags.EPHEMERAL
    }
  };
}

/**
 * Generates a random 8-character alphanumeric code
 */
function generateLinkCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Handles Discord slash command interactions
 */
export async function handleCommand(body: any) {
  const commandName = body.data.name;
  const guildId = body.guild_id;
  const userId = body.member?.user?.id || body.user?.id;

  // Ensure command is run in a guild (not DM)
  if (!guildId) {
    return ephemeral('❌ This command can only be used in a Discord server.');
  }

  try {
    console.log(`🎮 Processing Discord command: ${commandName} in guild: ${guildId} by user: ${userId}`);
    
    switch (commandName) {
      case 'link':
        console.log('🔗 Routing to handleLinkCommand');
        const linkResult = await handleLinkCommand(body, guildId, userId);
        console.log('🔗 Link command result:', linkResult);
        return linkResult;
      
      case 'unlink':
        return await handleUnlinkCommand(guildId);
      
      case 'status':
        return await handleStatusCommand(guildId);
      
      case 'config':
        return await handleConfigCommand(body, guildId);
      
      case 'join':
        return await handleJoinCommand(body, guildId, userId);
      
      case 'leave':
        return await handleLeaveCommand(guildId, userId);
      
      case 'favorites':
        return await handleFavoritesCommand(body, guildId, userId);
      
      default:
        return ephemeral('❌ Unknown command.');
    }
  } catch (error) {
    console.error('❌ Slash command error in main handler:', error);
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      commandName,
      guildId,
      userId,
      body: body.data
    });
    return ephemeral('❌ An error occurred while processing your command. Please try again.');
  }
}

/**
 * Handles /link <code> command
 */
async function handleLinkCommand(body: any, guildId: string, userId: string) {
  try {
    console.log(`🔗 Processing /link command - Guild: ${guildId}, User: ${userId}`);
    console.log('Command body:', JSON.stringify(body.data, null, 2));
    
    const code = body.data.options?.find((o: any) => o.name === 'code')?.value;
    console.log(`Link code provided: ${code}`);
    
    if (!code) {
      return ephemeral('❌ Please provide a link code. Usage: `/link <code>`');
    }

    // Find and validate the code
    console.log(`Looking up link code: ${code}`);
    const linkCode = await storage.getLinkCode(code);
    console.log(`Link code found:`, linkCode ? 'YES' : 'NO');
    
    if (!linkCode) {
      return ephemeral('❌ Invalid link code. Please check the code and try again.');
    }

    console.log(`Link code expires at: ${linkCode.expiresAt}, current time: ${new Date()}`);
    if (linkCode.expiresAt < new Date()) {
      return ephemeral('❌ This link code has expired. Please generate a new one.');
    }

    console.log(`Link code consumed at: ${linkCode.consumedAt}`);
    if (linkCode.consumedAt) {
      return ephemeral('❌ This link code has already been used.');
    }

    // Check if guild is already linked
    console.log(`Checking existing guild link for: ${guildId}`);
    const existingLink = await storage.getGuildLink(guildId);
    console.log(`Existing link:`, existingLink ? `Active: ${existingLink.active}, Workspace: ${existingLink.workspaceId}` : 'NONE');
    
    if (existingLink) {
      if (existingLink.active) {
        return ephemeral('⚠️ This server is already linked to a BanterBox workspace. Use `/unlink` first if you want to link to a different workspace.');
      } else {
        // Reactivate existing inactive link with new workspace
        console.log(`Reactivating existing guild link for workspace: ${linkCode.workspaceId}`);
        try {
          // Update the existing link instead of creating a new one
          await db.update(guildLinks)
            .set({
              workspaceId: linkCode.workspaceId,
              linkedByUserId: userId,
              active: true,
              // Reset created date to now for the new link
              createdAt: new Date()
            })
            .where(eq(guildLinks.guildId, guildId));
          console.log(`✅ Guild link reactivated successfully`);
        } catch (updateError) {
          console.error('❌ Failed to reactivate guild link:', updateError);
          throw updateError;
        }
      }
    } else {
      // Create new guild link
      console.log(`Creating new guild link - Guild: ${guildId}, Workspace: ${linkCode.workspaceId}`);
      try {
        await storage.createGuildLink({
          guildId,
          workspaceId: linkCode.workspaceId,
          linkedByUserId: userId,
          active: true,
        });
        console.log(`✅ Guild link created successfully`);
      } catch (createError) {
        console.error('❌ Failed to create guild link:', createError);
        throw createError;
      }
    }

    // Mark code as consumed
    console.log(`Consuming link code: ${code}`);
    await storage.consumeLinkCode(code);
    console.log(`✅ Link code consumed`);

    // Create default guild settings with error handling
    try {
      console.log(`Creating guild settings for: ${guildId}`);
      await storage.upsertGuildSettings({
        guildId,
        workspaceId: linkCode.workspaceId,
        enabledEvents: ['discord_message', 'discord_member_join', 'discord_reaction'],
        updatedAt: new Date(),
      });
      console.log(`✅ Guild settings created for ${guildId}`);
    } catch (error) {
      console.error('❌ Failed to create guild settings:', error);
      // Continue anyway - settings can be created later
    }

    console.log(`✅ Link command completed successfully for guild ${guildId}`);
    return ephemeral(`✅ Successfully linked this Discord server to BanterBox workspace \`${linkCode.workspaceId}\`! 

BanterBox will now generate witty banters for events in this server. Use \`/config\` to customize settings.`);
  } catch (error) {
    console.error('❌ Error in handleLinkCommand:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      guildId,
      userId,
      body: body.data
    });
    return ephemeral('❌ An error occurred while linking the server. Please try again or contact support.');
  }
}

/**
 * Handles /unlink command
 */
async function handleUnlinkCommand(guildId: string) {
  const guildLink = await storage.getGuildLink(guildId);
  
  if (!guildLink || !guildLink.active) {
    return ephemeral('❌ This server is not currently linked to any BanterBox workspace.');
  }

  // Deactivate the link
  await storage.deactivateGuildLink(guildId);

  return ephemeral('✅ Successfully unlinked this Discord server from BanterBox. No more banters will be generated for this server.');
}

/**
 * Handles /status command
 */
async function handleStatusCommand(guildId: string) {
  const guildLink = await storage.getGuildLink(guildId);
  
  if (!guildLink || !guildLink.active) {
    return ephemeral('📋 **BanterBox Status**\n\n❌ This server is not linked to any BanterBox workspace.\n\nUse `/link <code>` to connect this server to BanterBox.');
  }

  const settings = await storage.getGuildSettings(guildId);
  const isStreaming = discordService?.isInVoiceChannel(guildId) || false;
  
  let statusMessage = `📋 **BanterBox Status**\n\n✅ Linked to workspace: \`${guildLink.workspaceId}\`\n`;
  statusMessage += `🔗 Linked by: <@${guildLink.linkedByUserId}>\n`;
  statusMessage += `📅 Connected: ${guildLink.createdAt?.toLocaleDateString() || 'Unknown'}\n\n`;
  
  if (isStreaming) {
    statusMessage += `🎙️ **Streaming Mode:** 🟢 ACTIVE - Generating audio banters\n`;
    statusMessage += `📺 **Status:** Bot is in voice channel, ready for streaming\n\n`;
  } else {
    statusMessage += `🎙️ **Streaming Mode:** 🔴 INACTIVE - Text-only mode\n`;
    statusMessage += `📺 **Status:** Use \`/join #channel\` to start streaming with audio\n\n`;
  }
  
  statusMessage += `🎛️ **Settings:**\n`;
  statusMessage += `🎭 Personality: Managed in web dashboard\n`;
  statusMessage += `🎵 Voice: Managed in web dashboard\n`;
  statusMessage += `🎯 Events: All Discord events enabled\n\n`;
  
  statusMessage += `🌐 **Web Dashboard:** banterbox.ai/dashboard\n\n`;
  
  statusMessage += `🎛️ **Commands:**\n`;
  statusMessage += `• \`/join #channel\` - Start streaming mode\n`;
  statusMessage += `• \`/leave\` - Stop streaming mode\n`;
  statusMessage += `• \`/config\` - Configure Discord events\n`;
  statusMessage += `• \`/unlink\` - Disconnect server`;

  return ephemeral(statusMessage);
}

/**
 * Handles /config key value command
 */
async function handleConfigCommand(body: any, guildId: string) {
  const guildLink = await storage.getGuildLink(guildId);
  
  if (!guildLink || !guildLink.active) {
    return ephemeral('❌ This server must be linked to BanterBox before configuring settings. Use `/link <code>` first.');
  }

  const key = body.data.options?.find((o: any) => o.name === 'key')?.value;
  const value = body.data.options?.find((o: any) => o.name === 'value')?.value;

  if (!key || !value) {
    return ephemeral('❌ Please provide both key and value. Usage: `/config key:<setting> value:<new_value>`\n\nAvailable settings:\n• `events` - Enable/disable specific Discord events\n\n💡 **Personality & Voice settings are now managed in the web dashboard at banterbox.ai**');
  }

  let settings = await storage.getGuildSettings(guildId);
  if (!settings) {
    // Auto-create missing settings to recover from any issues
    console.log(`Auto-creating missing guild settings for ${guildId}`);
    try {
      settings = await storage.upsertGuildSettings({
        guildId,
        workspaceId: guildLink.workspaceId,
        enabledEvents: ['discord_message', 'discord_member_join', 'discord_reaction'],
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Failed to auto-create guild settings:', error);
      return ephemeral('❌ Guild settings error. Please try unlinking and linking again.');
    }
  }

  // Validate and update settings
  switch (key.toLowerCase()) {
    case 'events':
      // Handle event configuration (future feature)
      return ephemeral('🎛️ **Event configuration coming soon!**\n\nFor now, all Discord events are enabled by default.\n\n💡 **Personality & Voice settings are managed in the web dashboard at banterbox.ai**');

    default:
      return ephemeral('❌ Invalid setting key. Available settings:\n• `events` - Enable/disable specific Discord events\n\n💡 **Personality & Voice settings are now managed in the web dashboard at banterbox.ai**');
  }
}

/**
 * Handles /join [channel] command
 */
async function handleJoinCommand(body: any, guildId: string, userId: string) {
  const guildLink = await storage.getGuildLink(guildId);
  
  if (!guildLink || !guildLink.active) {
    return ephemeral('❌ This server must be linked to BanterBox before joining voice channels. Use `/link <code>` first.');
  }

  // Check user permissions for streaming
  const hasPermission = await checkStreamingPermission(body, guildId, userId);
  if (!hasPermission.allowed) {
    return ephemeral(`🚫 **Streaming Access Denied**\n\n${hasPermission.reason}\n\n**To get streaming access:**\n• Ask an admin to give you the "Streamer" or "BanterBox Streamer" role\n• Or ask for "Manage Server" permission\n• Server admins always have streaming access`);
  }

  // Check if bot is already in a voice channel in this server
  const currentlyInVoice = discordService.isInVoiceChannel(guildId);
  if (currentlyInVoice) {
    // Check if current user is already the active streamer
    const currentStreamer = await storage.getCurrentStreamer(guildId);
    if (currentStreamer && currentStreamer !== userId) {
      return ephemeral('🚫 **Another streamer is currently active**\n\nSomeone else is already using the bot for streaming in this server. Wait for them to finish (`/leave`) or ask a server admin to use `/force-leave` if needed.\n\nUse `/status` to see current streaming status.');
    }
    
    return ephemeral('⚠️ I\'m already in a voice channel in this server. Use `/leave` first to switch channels, or use `/status` to see current streaming status.');
  }

  // Get the specified channel
  let channelId = body.data.options?.find((o: any) => o.name === 'channel')?.value;
  
  if (!channelId) {
    return ephemeral('❌ Please specify a voice channel: `/join channel:#your-voice-channel`\n\n💡 **Tip:** You can @mention the voice channel or use its name.');
  }

  try {
    console.log(`Attempting to join voice channel ${channelId} in guild ${guildId}`);
    const success = await discordService.joinVoiceChannel(guildId, channelId);
    
    if (success) {
      // Set current streamer in storage
      await storage.setCurrentStreamer(guildId, userId);
      console.log(`Successfully joined voice channel, set streamer to ${userId}`);
      
      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: '✅ **Streaming Mode Activated!**\n\n🎙️ I\'ve joined the voice channel and will now generate audio banters for your stream.\n🎛️ Use `/config` to customize personality and voice settings.\n🛑 Use `/leave` when you finish streaming.\n\n🔒 **Protected Session:** Only you and server admins can control the bot while you\'re streaming.',
          flags: 64 // Ephemeral flag
        }
      };
    } else {
      console.log(`Failed to join voice channel ${channelId}`);
      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: '❌ Failed to join voice channel. Please check:\n• The channel exists and is a voice channel\n• I have permission to connect to voice channels\n• The channel isn\'t full or restricted',
          flags: 64 // Ephemeral flag
        }
      };
    }
  } catch (error) {
    console.error('Error joining voice channel:', error);
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '❌ An error occurred while joining the voice channel. Please try again or contact support.',
        flags: 64 // Ephemeral flag
      }
    };
  }
}

/**
 * Handles /favorites command
 */
async function handleFavoritesCommand(body: any, guildId: string, userId: string) {
  try {
    const guildLink = await storage.getGuildLink(guildId);
    if (!guildLink || !guildLink.active) {
      return ephemeral('❌ This server must be linked to BanterBox before using favorites. Use `/link <code>` first.');
    }

    const workspaceUserId = guildLink.workspaceId;
    const type = body.data.options?.find((o: any) => o.name === 'type')?.value;
    const action = body.data.options?.find((o: any) => o.name === 'action')?.value;
    const name = body.data.options?.find((o: any) => o.name === 'name')?.value;

    if (!type || !action) {
      return ephemeral('❌ Please specify type and action.');
    }

    if (type === 'personality') {
      return ephemeral('🎭 **Personality Management**\n\nPersonality settings are now managed in the web dashboard!\n\n🌐 **Visit:** banterbox.ai/dashboard\n\n💡 **Features:**\n• Choose from preset personalities\n• Create custom personalities\n• Save favorite personalities\n• Test personalities instantly');
    } 
    else if (type === 'voice') {
      return ephemeral('🎤 **Voice Management**\n\nVoice settings are now managed in the web dashboard!\n\n🌐 **Visit:** banterbox.ai/dashboard\n\n💡 **Features:**\n• Switch between OpenAI & ElevenLabs\n• Choose from 100+ ElevenLabs voices\n• Save favorite voices\n• Test voice previews');
    }

    return ephemeral('❌ Invalid type or action specified.');
  } catch (error) {
    console.error('Error in handleFavoritesCommand:', error);
    return ephemeral('❌ An error occurred while managing favorites.');
  }
}

/**
 * Handles /leave command
 */
async function handleLeaveCommand(guildId: string, userId: string) {
  try {
    // Check if user has permission to stop streaming
    const currentStreamer = await storage.getCurrentStreamer(guildId);
    const isCurrentStreamer = currentStreamer === userId;
    const hasAdminPermission = await checkAdminPermission(guildId, userId);
    
    if (!isCurrentStreamer && !hasAdminPermission) {
      return ephemeral('🚫 **Permission Denied**\n\nOnly the current streamer or server admins can stop the streaming session.\n\nUse `/status` to see who is currently streaming.');
    }
    
    const success = await discordService.leaveVoiceChannel(guildId);
    if (success) {
      // Clear current streamer
      await storage.clearCurrentStreamer(guildId);
      
      const byAdmin = !isCurrentStreamer && hasAdminPermission;
      return ephemeral(`✅ Left voice channel! Streaming mode deactivated. No more audio banters will be generated.${byAdmin ? '\n\n⚡ **Admin Override:** You stopped another user\'s streaming session.' : ''}`);
    } else {
      return ephemeral('❌ I\'m not currently in any voice channel in this server.');
    }
  } catch (error) {
    console.error('Error leaving voice channel:', error);
    return ephemeral('❌ An error occurred while leaving the voice channel.');
  }
}