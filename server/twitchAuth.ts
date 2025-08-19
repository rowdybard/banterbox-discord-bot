import type { Express, RequestHandler } from "express";
import { randomBytes } from "crypto";
import { firebaseStorage } from "./firebaseStorage";

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || "";
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || "";
const TWITCH_REDIRECT_URI = process.env.TWITCH_REDIRECT_URI || "http://localhost:5000/api/twitch/callback";

interface TwitchTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  scope: string[];
  token_type: string;
}

interface TwitchUserResponse {
  data: Array<{
    id: string;
    login: string;
    display_name: string;
    type: string;
    broadcaster_type: string;
    description: string;
    profile_image_url: string;
    offline_image_url: string;
    view_count: number;
    created_at: string;
  }>;
}

export function setupTwitchAuth(app: Express) {
  // Start Twitch OAuth flow
  app.get("/api/twitch/auth", async (req: any, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Must be logged in to connect Twitch" });
    }

    const state = randomBytes(32).toString("hex");
    req.session.twitchState = state;

    const scopes = [
      "user:read:chat",
      "user:bot",
      "channel:bot",
      "channel:read:subscriptions",
      "bits:read",
      "moderator:read:followers"
    ];

    const authUrl = new URL("https://id.twitch.tv/oauth2/authorize");
    authUrl.searchParams.set("client_id", TWITCH_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", TWITCH_REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes.join(" "));
    authUrl.searchParams.set("state", state);

    res.redirect(authUrl.toString());
  });

  // Handle Twitch OAuth callback
  app.get("/api/twitch/callback", async (req: any, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Must be logged in" });
    }

    const { code, state } = req.query;
    
    if (!code || !state || state !== req.session.twitchState) {
      return res.status(400).json({ message: "Invalid OAuth state or missing code" });
    }

    try {
      // Exchange code for tokens
      const tokenResponse = await fetch("https://id.twitch.tv/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: TWITCH_CLIENT_ID,
          client_secret: TWITCH_CLIENT_SECRET,
          code: code as string,
          grant_type: "authorization_code",
          redirect_uri: TWITCH_REDIRECT_URI,
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error(`Token exchange failed: ${tokenResponse.status}`);
      }

      const tokens: TwitchTokenResponse = await tokenResponse.json();

      // Get user info
      const userResponse = await fetch("https://api.twitch.tv/helix/users", {
        headers: {
          "Authorization": `Bearer ${tokens.access_token}`,
          "Client-Id": TWITCH_CLIENT_ID,
        },
      });

      if (!userResponse.ok) {
        throw new Error(`User info fetch failed: ${userResponse.status}`);
      }

      const userData: TwitchUserResponse = await userResponse.json();
      const twitchUser = userData.data[0];

      // Save Twitch settings
      const userId = req.user.id;
      await firebaseStorage.upsertTwitchSettings({
        userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        twitchUsername: twitchUser.login,
        twitchUserId: twitchUser.id,
        isConnected: true,
        enabledEvents: ['chat', 'subscribe', 'cheer', 'raid', 'follow'],
      });

      // Clear state
      delete req.session.twitchState;

      // Redirect to settings page with success
      res.redirect("/settings?twitch=connected");
    } catch (error) {
      console.error("Twitch OAuth error:", error);
      res.redirect("/settings?twitch=error");
    }
  });

  // Disconnect Twitch
  app.post("/api/twitch/disconnect", async (req: any, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const userId = req.user.id;
      const twitchSettings = await firebaseStorage.getTwitchSettings(userId);

      if (twitchSettings?.accessToken) {
        // Revoke the access token
        await fetch("https://id.twitch.tv/oauth2/revoke", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: TWITCH_CLIENT_ID,
            token: twitchSettings.accessToken,
          }),
        });
      }

      // Update settings to disconnected
      await firebaseStorage.upsertTwitchSettings({
        userId,
        isConnected: false,
        accessToken: null,
        refreshToken: null,
        twitchUsername: null,
        twitchUserId: null,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error disconnecting Twitch:", error);
      res.status(500).json({ message: "Failed to disconnect Twitch" });
    }
  });

  // Get Twitch connection status
  app.get("/api/twitch/status", async (req: any, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const userId = req.user.id;
      const twitchSettings = await firebaseStorage.getTwitchSettings(userId);

      res.json({
        isConnected: twitchSettings?.isConnected || false,
        username: twitchSettings?.twitchUsername || null,
        enabledEvents: twitchSettings?.enabledEvents || [],
      });
    } catch (error) {
      console.error("Error getting Twitch status:", error);
      res.status(500).json({ message: "Failed to get Twitch status" });
    }
  });

  // Update Twitch event settings
  app.put("/api/twitch/settings", async (req: any, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const { enabledEvents } = req.body;
      const userId = req.user.id;

      await firebaseStorage.updateTwitchEventSettings(userId, enabledEvents);

      res.json({ success: true });
    } catch (error) {
      console.error("Error updating Twitch settings:", error);
      res.status(500).json({ message: "Failed to update Twitch settings" });
    }
  });
}

export async function refreshTwitchToken(refreshToken: string): Promise<TwitchTokenResponse | null> {
  try {
    const response = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: TWITCH_CLIENT_ID,
        client_secret: TWITCH_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error refreshing Twitch token:", error);
    return null;
  }
}