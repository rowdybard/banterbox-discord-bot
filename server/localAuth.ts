import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { firebaseStorage } from "./firebaseStorage";
import bcrypt from "bcrypt";
import { Strategy as LocalStrategy } from "passport-local";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  
  // Use memory store for local development since we're not using PostgreSQL
  return session({
    secret: process.env.SESSION_SECRET || 'dev-secret-key-for-local-development-only',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
      sameSite: 'lax' as const,
    },
  });
}

// Local authentication strategy
passport.use(new LocalStrategy(
  {
    usernameField: 'email',
    passwordField: 'password'
  },
  async (email, password, done) => {
    try {
      // Check if user exists
      const user = await firebaseStorage.getUserByEmail(email);
      if (!user) {
        return done(null, false, { message: 'Invalid email or password' });
      }

      // Check password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash as string);
      if (!isValidPassword) {
        return done(null, false, { message: 'Invalid email or password' });
      }

      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }
));

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
          const user = await firebaseStorage.getUser(id);
    if (!user) {
      return done(null, false);
    }
    done(null, user);
  } catch (error) {
    done(error);
  }
});

// Authentication middleware
export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Not authenticated' });
};

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Login route
  app.post('/api/auth/login', passport.authenticate('local'), (req, res) => {
    res.json({ 
      success: true, 
      user: {
        id: (req.user as any)?.id,
        email: (req.user as any)?.email,
        firstName: (req.user as any)?.firstName,
        lastName: (req.user as any)?.lastName
      }
    });
  });

  // Register route
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;
      
      // Check if user already exists
      const existingUser = await firebaseStorage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: 'User already exists' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user
              const user = await firebaseStorage.upsertUser({
        id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        email,
        firstName,
        lastName,
        passwordHash
      });

      // Log in the user
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ error: 'Login failed after registration' });
        }
        res.json({ 
          success: true, 
          user: {
            id: (req.user as any)?.id,
            email: (req.user as any)?.email,
            firstName: (req.user as any)?.firstName,
            lastName: (req.user as any)?.lastName
          }
        });
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  // Logout route
  app.post('/api/auth/logout', (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: 'Logout failed' });
      }
      res.json({ success: true });
    });
  });

  // Get current user
  app.get('/api/auth/me', (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    res.json({
      user: {
        id: (req.user as any)?.id,
        email: (req.user as any)?.email,
        firstName: (req.user as any)?.firstName,
        lastName: (req.user as any)?.lastName
      }
    });
  });
}
