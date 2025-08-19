import passport from "passport";
import { Strategy as DiscordStrategy } from "passport-discord";
import { storage } from "./storage";

// Use Firebase storage instead of PostgreSQL
const conString = process.env.DATABASE_URL || "firebase";

export function setupDiscordAuth(app: any) {
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
    console.log("⚠️  Discord OAuth not configured - skipping Discord authentication");
    return;
  }

  passport.use(
    new DiscordStrategy(
      {
        clientID: process.env.DISCORD_CLIENT_ID!,
        clientSecret: process.env.DISCORD_CLIENT_SECRET!,
        callbackURL: process.env.NODE_ENV === "production"
          ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}/api/auth/discord/callback`
          : "http://localhost:5000/api/auth/discord/callback",
        scope: ["identify", "email", "guilds"],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.email;
          if (!email) {
            return done(new Error("No email found in Discord profile"));
          }

          // Check if user already exists
          let user = await storage.getUserByEmail(email);

          if (!user) {
            // Create new user
            user = await storage.createUser({
              email,
              firstName: profile.username,
              profileImageUrl: profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` : null,
              subscriptionTier: "free",
              subscriptionStatus: "active",
              hasCompletedOnboarding: false,
            });
          } else {
            // Update existing user with latest profile info
            user = await storage.upsertUser({
              ...user,
              firstName: profile.username || user.firstName,
              profileImageUrl: profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` : user.profileImageUrl,
            });
          }

          // Update Discord settings
          await storage.upsertDiscordSettings({
            userId: user.id,
            discordUserId: profile.id,
            discordUsername: profile.username,
            discordTag: `${profile.username}#${profile.discriminator}`,
            accessToken,
            refreshToken,
            isConnected: true,
            enabledEvents: ["discord_message", "discord_member_join", "discord_reaction"],
            connectedGuilds: profile.guilds || [],
          });

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  app.get("/api/auth/discord", passport.authenticate("discord"));

  app.get(
    "/api/auth/discord/callback",
    passport.authenticate("discord", { failureRedirect: "/login" }),
    (req, res) => {
      // Successful authentication, redirect home
      res.redirect("/");
    }
  );
}