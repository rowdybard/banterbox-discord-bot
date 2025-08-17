import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage.js";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    name: "banterbox.sid", // New session name to clear old sessions
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
    },
  });
}

export async function setupGoogleAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Check if Google OAuth credentials are available
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn("⚠️  Google OAuth credentials not found. Google authentication will not work.");
    console.warn("📝 Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.");
    return;
  }

  console.log("✅ Setting up Google OAuth with credentials");

  // Google OAuth Strategy
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: process.env.NODE_ENV === "production" 
          ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}/api/auth/google/callback`
          : "/api/auth/google/callback",
      },
      async (accessToken: string, refreshToken: string, profile: any, done: any) => {
        try {
          console.log("Google OAuth profile received:", {
            id: profile.id,
            email: profile.emails?.[0]?.value,
            name: profile.displayName
          });

          // Get user info from Google profile
          const googleId = profile.id;
          const email = profile.emails?.[0]?.value;
          const firstName = profile.name?.givenName;
          const lastName = profile.name?.familyName;
          const profileImageUrl = profile.photos?.[0]?.value;

          // Check if user already exists by email
          const existingUser = email ? await storage.getUserByEmail(email) : null;
          
          // Create or update user in database
          const user = await storage.upsertUser({
            // Use existing ID if user exists, otherwise use Google ID
            id: existingUser ? existingUser.id : googleId,
            email: email || null,
            firstName: firstName || null,
            lastName: lastName || null,
            profileImageUrl: profileImageUrl || null,
          });

          console.log("User created/updated:", user);
          return done(null, user);
        } catch (error) {
          console.error("Error in Google OAuth callback:", error);
          return done(error, null);
        }
      }
    )
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        // User not found, clear session
        return done(null, false);
      }
      done(null, user);
    } catch (error) {
      console.error("Deserialize user error:", error);
      // Clear invalid session
      done(null, false);
    }
  });

  // Auth routes
  app.get("/api/auth/google", passport.authenticate("google", {
    scope: ["profile", "email"]
  }));

  app.get("/api/auth/google/callback", 
    passport.authenticate("google", { 
      failureRedirect: "/?error=auth_failed" 
    }),
    (req, res) => {
      try {
        console.log("OAuth callback successful, user:", req.user);
        if (!req.user) {
          console.error("OAuth callback: No user object after authentication");
          return res.redirect("/?error=no_user");
        }
        res.redirect("/?auth=success");
      } catch (error) {
        console.error("OAuth callback error:", error);
        res.redirect("/?error=callback_error");
      }
    }
  );

  app.get("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
      }
      res.redirect("/");
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};
