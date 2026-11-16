# Deploy AirPulse to Vercel

Create two Vercel projects from this repository, with root directories `server` and `client`. The Express app is exported from server/src/app.js for Vercel; server/src/server.js remains the local startup command. Configuration files set Prisma generation for the backend and Vite build output for the frontend. The database must be hosted separately from the developer's Mac.

## Backend and database

1. Import the repository as `airpulse-api`, choosing `server` as Root Directory and Express as framework.
2. Connect a new dedicated Neon PostgreSQL database through Vercel Marketplace/Storage. Choose a region close to your Vercel backend and review the provider's plan before creating it.
3. Ensure DATABASE_URL is set on the backend for the deployment environment. Use the provider's supplied PostgreSQL URL including its SSL options. Keep DATABASE_URL_UNPOOLED if provided: Prisma CLI uses that direct connection for migrations, while the API uses DATABASE_URL. Never use a VITE_ prefix for this secret.
4. Set CLIENT_ORIGIN to the frontend's final HTTPS origin when it is known. Simulation is disabled unless ENABLE_SIMULATION=true. That option allows any visitor with API access to append simulated readings; choose it only for an intentional public demo.
5. Before serving the app, migrate and seed this dedicated hosted database from Terminal. First link the `server` folder to `airpulse-api` with `vercel link`, then pull the environment into an ignored file:

   vercel env pull .env.production.local --environment=production

   Node can load that file for the setup commands without copying credentials into shell history:

   node --env-file=.env.production.local node_modules/prisma/build/index.js generate
   node --env-file=.env.production.local node_modules/prisma/build/index.js migrate deploy
   node --env-file=.env.production.local --import tsx prisma/seed.js

   Run these from server after npm ci, with a supported Node version (the local project uses Node 24). These commands create schema and three demo stations; they do not copy your local measurement history. Do not run database resets on the hosted database.
6. Deploy/redeploy the backend, and check /api/health, /api/db-health and /api/stations. Production access protection must permit intended frontend clients to call the API; do not expose a bypass secret in Vite.

## Frontend

Import the same repository as `airpulse`, choosing `client` as Root Directory and Vite as framework. Set VITE_DEMO_MODE=false and VITE_API_URL=https://YOUR-BACKEND-DOMAIN/api. Set CLIENT_ORIGIN on the backend to https://YOUR-FRONTEND-DOMAIN (without a trailing slash), then redeploy the backend. Vite's local development proxy is not available on the hosted frontend; the absolute API URL is required for this two-project setup.

Verify station listing, history, both simulation buttons if enabled, and CSV export on the actual deployed frontend. Preview deployment domains also require an explicit matching CORS origin; the default setup supports the one origin specified by CLIENT_ORIGIN.

The frontend and backend builds can be verified locally. Deployment, hosted migrations and end-to-end checks must still be completed against the configured accounts; adding these files alone does not publish the app.
