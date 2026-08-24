// Vercel only auto-detects Serverless Functions in a top-level /api
// directory, so the entry point has to live here rather than under
// server/. Vercel rewrites every /api/* request to this function while
// leaving the original path (e.g. /api/orders) untouched, so Express's own
// router still handles it exactly like the persistent-server deployment.
import { createApp } from "../server/src/app";

const app = createApp();

export default app;
