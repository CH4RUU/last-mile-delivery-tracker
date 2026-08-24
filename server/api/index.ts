// Vercel serverless entry point. Vercel rewrites every /api/* request to this
// function while leaving the original path (e.g. /api/orders) untouched, so
// the same Express app used for the persistent-server deployment (Render)
// works here unchanged - Express does its own routing off req.url.
import { createApp } from "../src/app";

const app = createApp();

export default app;
