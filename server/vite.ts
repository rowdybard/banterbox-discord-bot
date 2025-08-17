import type { Express } from 'express';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function log(msg: string) {
  console.log(msg);
}

export async function setupVite(app: Express, _server: import('http').Server) {
  if (process.env.NODE_ENV !== 'development') return;
  // Load Vite at runtime so TS doesn’t try to type‑resolve its config
  // @ts-ignore – dynamic require for dev middleware
  const { createServer } = require('vite');
  const vite = await createServer({
    server: { middlewareMode: true },
    root: process.cwd(),
  });
  app.use(vite.middlewares);
}

export function serveStatic(app: Express) {
  const clientDir = path.resolve(process.cwd(), 'dist', 'client');
  if (fs.existsSync(clientDir)) {
    // @ts-ignore – express typings are fine but require keeps it simple here
    app.use(require('express').static(clientDir));
  }
}
