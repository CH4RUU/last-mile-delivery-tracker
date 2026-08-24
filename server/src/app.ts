import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { env } from "./config/env";
import { authRouter } from "./routes/auth";
import { zonesRouter } from "./routes/zones";
import { rateCardsRouter } from "./routes/rateCards";
import { agentsRouter } from "./routes/agents";
import { ordersRouter } from "./routes/orders";
import { errorHandler } from "./middleware/errorHandler";

export function createApp() {
  const app = express();
  app.use(cors({ origin: env.webOrigin }));
  app.use(express.json());

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRouter);
  app.use("/api/zones", zonesRouter);
  app.use("/api/rate-cards", rateCardsRouter);
  app.use("/api/agents", agentsRouter);
  app.use("/api/orders", ordersRouter);

  // Serve the built React SPA in production, from a single deployed service.
  const webDist = path.join(__dirname, "..", "web-dist");
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      res.sendFile(path.join(webDist, "index.html"));
    });
  }

  app.use(errorHandler);
  return app;
}
