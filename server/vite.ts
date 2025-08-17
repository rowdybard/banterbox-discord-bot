// server/vite.ts
import type { Express } from 'express';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';

export function log(msg: string) {
  console.log(msg);
}

export async function setupVite(app: Express, _server: unknown) {
  // Only enable Vite's dev middleware in development
  if (process.env.NODE_ENV !== 'development') return;

  // Dynamic ESM import so TS doesn't try to type‑resolve vite config
  const { createServer } = await import('vite');
  const vite = await createServer({
    server: { middlewareMode: true },
    root: process.cwd(),
  });
  app.use(vite.middlewares);
}

export function serveStatic(app: Express) {
  const clientDir = path.resolve(process.cwd(), 'dist', 'client');
  if (fs.existsSync(clientDir)) {
    app.use(express.static(clientDir));
  }
}
