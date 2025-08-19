import express, { Request, Response } from 'express';
import { URLSearchParams } from 'url';
import { firebaseStorage } from './firebaseStorage';
import { isAuthenticated } from './replitAuth';

interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  email?: string;
}

interface DiscordAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export class DiscordAuth {
  private config: DiscordAuthConfig;

  constructor(config: DiscordAuthConfig) {
    this.config = config;
  }

  // Generate Discord OAuth URL
  getAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: 'identify email guilds',
    });

    return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  }

  // Generate Discord OAuth URL with state parameter
  getAuthUrlWithState(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: 'identify email guilds',
      state: state,
    });

    return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  }

  // Exchange code for access token
  async exchangeCodeForToken(code: string): Promise<string> {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri,
    });

    const response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code for token');
    }

    const data = await response.json();
    return data.access_token;
  }

  // Get user information
  async getUser(accessToken: string): Promise<DiscordUser> {
    const response = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user data');
    }

    return await response.json();
  }

  // Get user's guilds
  async getUserGuilds(accessToken: string) {
    const response = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user guilds');
    }

    return await response.json();
  }

  // Setup routes for Discord OAuth
  setupRoutes(app: express.Application, storage: any) {
    // Start Discord OAuth
    app.get('/api/discord/auth', (req: Request, res: Response) => {
      const authUrl = this.getAuthUrl();
      res.redirect(authUrl);
    });

    // Discord OAuth callback
    app.get('/api/discord/callback', async (req: Request, res: Response) => {
      try {
        const { code } = req.query;
        
        if (!code || typeof code !== 'string') {
          return res.status(400).json({ error: 'No authorization code provided' });
        }

        // Exchange code for access token
        const accessToken = await this.exchangeCodeForToken(code);
        
        // Get user data
        const discordUser = await this.getUser(accessToken);
        
        // Get user's guilds
        const guilds = await this.getUserGuilds(accessToken);

        // Store Discord connection in user settings
        // You'll need to add Discord fields to your user settings schema
        
        res.json({
          success: true,
          user: discordUser,
          guilds: guilds.slice(0, 10), // Limit to first 10 guilds
        });
      } catch (error) {
        console.error('Discord OAuth error:', error);
        res.status(500).json({ error: 'Discord authentication failed' });
      }
    });

    // Disconnect Discord
    app.post('/api/discord/disconnect', async (req: Request, res: Response) => {
      try {
        // Remove Discord connection from user settings
        // Implementation depends on your user schema
        
        res.json({ success: true });
      } catch (error) {
        console.error('Discord disconnect error:', error);
        res.status(500).json({ error: 'Failed to disconnect Discord' });
      }
    });

    // Get Discord connection status
    app.get('/api/discord/status', async (req: Request, res: Response) => {
      try {
        // Check if user has Discord connected
        // Implementation depends on your user schema
        
        res.json({ connected: false, user: null });
      } catch (error) {
        console.error('Discord status error:', error);
        res.status(500).json({ error: 'Failed to get Discord status' });
      }
    });
  }
}

// Setup Discord authentication routes
export function setupDiscordAuth(app: express.Application) {
  // Get the domain from RENDER_EXTERNAL_HOSTNAME or use localhost for development
  const domain = process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost:5000';
  
  const discordAuth = new DiscordAuth({
    clientId: process.env.DISCORD_CLIENT_ID || '',
    clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
    redirectUri: `https://${domain}/api/discord/auth/callback`,
  });

  // Start Discord OAuth flow (manual auth check to handle direct navigation)
  app.get('/api/discord/auth/login', async (req: Request, res: Response) => {
    // Check authentication manually to provide better error handling
    const user = req.user as any;
    
    console.log('=== DISCORD AUTH START ===');
    console.log('Session exists:', !!req.session);
    console.log('User exists:', !!user);
    console.log('Is authenticated:', req.isAuthenticated?.());
    
    if (!req.isAuthenticated?.() || !user || !user.id) {
      console.log('User not authenticated, redirecting to login');
      // Store the return URL in session
      (req.session as any).returnTo = '/settings?discord=connect';
      return res.redirect('/api/login');
    }
    
    const userId = user.id;
    console.log('User ID:', userId);
    const stateData = { userId };
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64');
    console.log('State data:', stateData);
    console.log('Encoded state:', state);
    const authUrl = discordAuth.getAuthUrlWithState(state);
    console.log('Auth URL:', authUrl);
    console.log('=== REDIRECTING TO DISCORD ===');
    res.redirect(authUrl);
  });

  // Handle Discord OAuth callback (no auth middleware needed - we use state instead)
  app.get('/api/discord/auth/callback', async (req: Request, res: Response) => {
    try {
      const { code, state, error: authError } = req.query;
      
      console.log('Discord callback received:', { code: !!code, state: !!state, authError });
      
      if (authError) {
        console.error('Discord OAuth error:', authError);
        return res.redirect('/settings?discord=error&reason=oauth_denied');
      }
      
      if (!code || typeof code !== 'string') {
        console.error('No authorization code provided');
        return res.redirect('/settings?discord=error&reason=no_code');
      }

      if (!state || typeof state !== 'string') {
        console.error('No state parameter provided');
        return res.redirect('/settings?discord=error&reason=no_state');
      }

      // Decode state to get user ID
      let userId: string;
      try {
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
        userId = stateData.userId;
        if (!userId) {
          throw new Error('No userId in state');
        }
        console.log('Extracted userId from state:', userId);
      } catch (error) {
        console.error('Invalid state parameter:', error);
        return res.redirect('/settings?discord=error&reason=invalid_state');
      }

      // Exchange code for access token
      const accessToken = await discordAuth.exchangeCodeForToken(code);
      console.log('Discord access token obtained');
      
      // Get user information
      const discordUser = await discordAuth.getUser(accessToken);
      console.log('Discord user obtained:', discordUser.username);
      
      // Store Discord connection in database/storage
              await firebaseStorage.upsertDiscordSettings({
        userId,
        discordUserId: discordUser.id,
        discordUsername: discordUser.username,
        accessToken,
        isConnected: true,
        enabledEvents: ['discord_message', 'discord_member_join'],
      });

      res.redirect('/settings?discord=connected');
    } catch (error) {
      console.error('Discord auth error:', error);
      res.redirect('/settings?discord=error&reason=server_error');
    }
  });
}

export default DiscordAuth;