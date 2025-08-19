import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { storage } from "./storage";

// Use Firebase storage instead of PostgreSQL
const conString = process.env.DATABASE_URL || "firebase";

export function setupGoogleAuth(app: any) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.log("⚠️  Google OAuth not configured - skipping Google authentication");
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: process.env.NODE_ENV === "production"
          ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}/api/auth/google/callback`
          : "http://localhost:5000/api/auth/google/callback",
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error("No email found in Google profile"));
          }

          // Check if user already exists
          let user = await storage.getUserByEmail(email);

          if (!user) {
            // Create new user
            user = await storage.createUser({
              email,
              firstName: profile.name?.givenName,
              lastName: profile.name?.familyName,
              profileImageUrl: profile.photos?.[0]?.value,
              subscriptionTier: "free",
              subscriptionStatus: "active",
              hasCompletedOnboarding: false,
            });
          } else {
            // Update existing user with latest profile info
            user = await storage.upsertUser({
              ...user,
              firstName: profile.name?.givenName || user.firstName,
              lastName: profile.name?.familyName || user.lastName,
              profileImageUrl: profile.photos?.[0]?.value || user.profileImageUrl,
            });
          }

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  app.get("/api/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

  app.get(
    "/api/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/login" }),
    (req, res) => {
      // Successful authentication, redirect home
      res.redirect("/");
    }
  );
}
