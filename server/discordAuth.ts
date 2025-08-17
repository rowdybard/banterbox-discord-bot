import express, { type Request, type Response } from 'express';
import { URLSearchParams } from 'node:url';
import { storage } from './storage.js';

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

  // Build the Discord OAuth2 URL
  getAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: 'identify email guilds',
    });
    return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  }

  // Same as above but with state payload
  getAuthUrlWithState(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: 'identify email guilds',
      state,
    });
    return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  }

  // Exchange an authorization code for an access token
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
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) throw new Error('Failed to exchange code for token');
    const data = (await response.json()) as { access_token: string };
    return data.access_token;
  }

  // Fetch the current user
  async getUser(accessToken: string): Promise<DiscordUser> {
    const response = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new Error('Failed to fetch user data');
    return (await response.json()) as DiscordUser;
  }

  // Fetch the user's guilds
  async getUserGuilds(accessToken: string): Promise<any[]> {
    const response = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new Error('Failed to fetch user guilds');
    return (await response.json()) as any[];
  }
}

// ---------------------------------------------------------------------------
// Route wiring
// ---------------------------------------------------------------------------

export function setupDiscordAuth(app: express.Application) {
  // Preferred external domain: REPLIT_DOMAINS first, else localhost
  const domain = process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';

  const discordAuth = new DiscordAuth({
    clientId: process.env.DISCORD_CLIENT_ID || '',
    clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
    // Keep this path in sync with the callback route below
    redirectUri: `https://${domain}/api/discord/auth/callback`,
  });

  // Start OAuth (manual auth check to handle direct nav)
  app.get('/api/discord/auth/login', async (req: Request, res: Response) => {
    const user = (req as any).user as { claims?: { sub?: string } } | undefined;
    const isAuthed = typeof (req as any).isAuthenticated === 'function' ? (req as any).isAuthenticated() : Boolean(user);

    if (!isAuthed || !user?.claims?.sub) {
      // Remember where to go after login
      (req.session as any).returnTo = '/settings?discord=connect';
      return res.redirect('/api/login');
    }

    const userId = user.claims.sub!;
    const stateData = { userId };
    const state = Buffer.from(JSON.stringify(stateData), 'utf8').toString('base64');

    const authUrl = discordAuth.getAuthUrlWithState(state);
    return res.redirect(authUrl);
  });

  // Discord redirects back here after user authorizes the app
  app.get('/api/discord/auth/callback', async (req: Request, res: Response) => {
    try {
      const { code, state, error: authError } = req.query as { code?: string; state?: string; error?: string };

      if (authError) return res.redirect('/settings?discord=error&reason=oauth_denied');
      if (!code) return res.redirect('/settings?discord=error&reason=no_code');
      if (!state) return res.redirect('/settings?discord=error&reason=no_state');

      // Decode state → userId
      let userId: string | undefined;
      try {
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf8')) as { userId?: string };
        userId = stateData.userId;
      } catch (e) {
        return res.redirect('/settings?discord=error&reason=invalid_state');
      }
      if (!userId) return res.redirect('/settings?discord=error&reason=no_user');

      // Exchange code for token & fetch user
      const accessToken = await discordAuth.exchangeCodeForToken(code);
      const discordUser = await discordAuth.getUser(accessToken);

      // Persist connection (trim guilds server-side if you wish)
     await storage.upsertDiscordSettings({
  userId,
  discordUserId: discordUser.id,
  discordUsername: discordUser.username,
  accessToken,
  isConnected: true,
  // send as JSON string to satisfy current type
  enabledEvents: JSON.stringify(['discord_message', 'discord_member_join']),
});

      // Where to go post-connect
      const returnTo = (req.session as any).returnTo as string | undefined;
      delete (req.session as any).returnTo;
      return res.redirect(returnTo || '/settings?discord=connected');
    } catch (err) {
      console.error('Discord auth error:', err);
      return res.redirect('/settings?discord=error&reason=server_error');
    }
  });

  // Optional: simple status endpoint
  app.get('/api/discord/status', async (_req: Request, res: Response) => {
    // Implement a real lookup if you store per-user records
    return res.json({ connected: false, user: null });
  });

  // Optional: disconnect endpoint (depends on your schema)
  app.post('/api/discord/disconnect', async (req: Request, res: Response) => {
    try {
      // TODO: delete or mark disconnected in your storage by userId
      return res.json({ success: true });
    } catch (e) {
      console.error('Discord disconnect error:', e);
      return res.status(500).json({ error: 'Failed to disconnect Discord' });
    }
  });
}

export default DiscordAuth;
