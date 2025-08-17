// server/replitAuth.ts
// Minimal, NodeNext‑safe auth helpers to replace memoizee usage and fix TS.
// Exposes: isAuthenticated middleware, requireAuth factory, getUser helper.

import type { Request, Response, NextFunction, RequestHandler } from 'express';

/** Return the current user object (whatever your passport/session attaches). */
export function getUser<T = any>(req: Request): T | undefined {
  return (req as any).user as T | undefined;
}

/** True if the request looks authenticated. Supports Passport or custom flags. */
export function isAuthed(req: Request): boolean {
  const fn = (req as any).isAuthenticated;
  if (typeof fn === 'function') return !!fn.call(req);
  return !!(req as any).user;
}

/** Express middleware: allow if authed, else remember path and redirect to /api/login. */
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (isAuthed(req)) return next();
  try {
    (req.session as any).returnTo = req.originalUrl || '/';
  } catch {
    // ignore if session is unavailable
  }
  return res.redirect('/api/login');
}

/** Factory if you prefer to mount like `app.get('/path', requireAuth(), handler)` */
export function requireAuth(): RequestHandler {
  return (req, res, next) => isAuthenticated(req, res, next);
}

export default { isAuthenticated, requireAuth, getUser, isAuthed };
