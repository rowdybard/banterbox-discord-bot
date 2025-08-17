// server/index.ts
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { createServer } from "node:http";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ── NEW: one switch to enable/disable the Discord pieces ───────────────
const ENABLE_DISCORD = process.env.BB_ENABLE_DISCORD === "1";
if (ENABLE_DISCORD) {
  try {
    await registerRoutes(app); // your existing bootstrap that wires Discord
  } catch (err) {
    console.warn("Discord failed to start:", (err as any)?.message);
  }
}
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      if (logLine.length > 80) logLine = logLine.slice(0, 79) + "…";
      log(logLine);
    }
  });

  next();
});

(async () => {
  let server;

  if (ENABLE_DISCORD) {
    try {
      // Your existing routes/bootstrap that also wires up Discord
      server = await registerRoutes(app);
      log("🎙️ Discord is ENABLED (BB_ENABLE_DISCORD=1)");
    } catch (error: any) {
      console.warn("⚠️  Discord service failed to start:", error?.message ?? error);
      console.log("📝 Continuing without Discord functionality…");
      server = createServer(app);
    }
  } else {
    // Minimal HTTP server (no Discord). Lets you deploy even if bot deps fail.
    log("🙈 Discord is DISABLED (BB_ENABLE_DISCORD not set to 1)");
    server = createServer(app);
  }

  // Error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });

  // Dev vs prod static/Vite
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    { port, host: "0.0.0.0", reusePort: true },
    () => log(`serving on port ${port}`)
  );
})();
