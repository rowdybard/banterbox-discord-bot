import fetch from 'node-fetch';

/**
 * Discord slash command definitions
 */
const commands = [
  {
    name: 'link',
    description: 'Link this Discord server to your BanterBox workspace',
    options: [
      {
        name: 'code',
        description: 'One-time link code from BanterBox',
        type: 3, // STRING
        required: true
      }
    ]
  },
  {
    name: 'unlink',
    description: 'Unlink this Discord server from BanterBox'
  },
  {
    name: 'status',
    description: 'Show BanterBox connection status and settings'
  },
  {
    name: 'config',
    description: 'Configure BanterBox settings for this server',
    options: [
      {
        name: 'key',
        description: 'Setting to configure (personality, voice)',
        type: 3, // STRING
        required: true,
        choices: [
          { name: 'personality', value: 'personality' },
          { name: 'voice', value: 'voice' }
        ]
      },
      {
        name: 'value',
        description: 'New value for the setting',
        type: 3, // STRING
        required: true
      }
    ]
  },
  {
    name: 'join',
    description: 'Join a voice channel to start streaming mode',
    options: [
      {
        name: 'channel',
        description: 'Voice channel to join (leave empty for your current channel)',
        type: 7, // CHANNEL
        required: false,
        channel_types: [2] // Voice channels only
      }
    ]
  },
  {
    name: 'leave',
    description: 'Leave voice channel and stop streaming mode'
  }
];

/**
 * Registers Discord slash commands globally
 * Should be called at server startup
 */
export async function registerCommands(): Promise<void> {
  const appId = process.env.DISCORD_APPLICATION_ID;
  const token = process.env.DISCORD_BOT_TOKEN;

  if (!appId || !token) {
    console.error('Missing Discord bot credentials. Please set DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN');
    return;
  }

  const url = `https://discord.com/api/v10/applications/${appId}/commands`;

  try {
    console.log('Registering Discord slash commands...');
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bot ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to register commands: ${response.status} ${error}`);
    }

    console.log('✅ Discord slash commands registered successfully');
  } catch (error) {
    console.error('❌ Failed to register Discord slash commands:', error);
    throw error;
  }
}

/**
 * Gets the Discord bot invite URL with proper permissions
 */
export function getBotInviteUrl(): string {
  const appId = process.env.DISCORD_APPLICATION_ID;
  
  if (!appId) {
    throw new Error('DISCORD_APPLICATION_ID not set');
  }

  // Bot permissions (calculated from Discord Developer Portal)
  // Read Messages/View Channels + Send Messages + Use Slash Commands + Read Message History + Connect + Speak
  const permissions = '277025394688';
  
  const params = new URLSearchParams({
    client_id: appId,
    scope: 'bot applications.commands',
    permissions: permissions
  });

  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}