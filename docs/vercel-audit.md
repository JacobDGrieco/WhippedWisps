# Vercel Deployment Audit

Date: 2026-09-06

## Current Shape

- Repository root is the only viable Vercel project root because `vercel.json`, `api/index.js`, `client`, and `server` all need to be visible to one deployment.
- Frontend is a Vite React app in `client`.
- Backend is an Express app in `server`, exported to Vercel through `api/index.js`.
- Data is stored in a local SQLite file through `better-sqlite3`.
- Uploaded photos are stored on the local filesystem through `multer.diskStorage`.

## Build Findings

### Must Use The Repository Root

Vercel project Root Directory must be the repository root. If it is set to `server` or `client`, the deployment cannot see all required files:

- `server` root cannot serve `client/dist` or see root `api/index.js`.
- `client` root cannot build or bundle the Express API.
- Root `vercel.json` is ignored if the Vercel project root is a subdirectory.

### Client Build Must Not Depend Only On Client Workspace Hoisting

The failing Vercel logs show `vite build` running inside `client`, then failing to import `@vitejs/plugin-react`. That package is declared in `client/package.json` and present in `package-lock.json`, so the repo metadata is correct. The fragile part is relying on a root workspace install/cache to make the dependency visible to `client/vite.config.js`.

The root package now explicitly declares the frontend build dependencies as root dev dependencies, and the Vercel build command reruns a full workspace install before building the client:

```sh
npm install --workspaces --include-workspace-root --include=dev && npm run build --workspace=client
```

This makes `@vitejs/plugin-react`, `vite`, React, and React Router available from the project root even when Vercel restores an incomplete workspace cache.

### Server Build Script Is Only A Fallback

`server/package.json` has a `build` script only because Vercel previously invoked the `server` workspace build. The intended Vercel path is the root `buildCommand` in `vercel.json`.

### Install Script Approvals Are Required

Current npm versions warn about dependency install scripts. The root `package.json` approves the reviewed versions:

- `better-sqlite3@11.10.0`
- `esbuild@0.21.5`

These are needed because `better-sqlite3` may compile a native addon and `esbuild` installs its platform binary.

## Runtime Findings

### SQLite Is Not Durable On Vercel

The app can start on Vercel with `DB_PATH=/tmp/whippedwisps.db`, but that is not production storage. Function instances are ephemeral and may not share files. Orders, settings, recipes, tags, Google Calendar tokens, and photo metadata can disappear or diverge across deployments and instances.

Production fix: move the data layer to durable external storage. The most direct Vercel-native option is Postgres, with a new database adapter replacing `server/src/db/*.js`.

### Uploaded Photos Are Not Durable On Vercel

`server/src/routes/photos.js` stores files under `UPLOADS_DIR` or `/tmp/whippedwisps-uploads` on Vercel. Uploaded photos can disappear and are not guaranteed to be served by later requests.

Production fix: move uploads to durable object storage such as Vercel Blob, S3, Cloudflare R2, or another persistent store. The `photos.file_path` column should store an object key or public URL instead of a local relative path.

### Google Calendar OAuth Tokens Are Stored In SQLite

The Calendar refresh token and calendar id are stored in the `settings` table. On Vercel with `/tmp` SQLite, reconnecting Google Calendar may be required whenever the function storage disappears.

Production fix: store settings in the same durable database used for orders, or move secrets/token state to a durable encrypted store.

### The App Has No Authentication

The README says the original deployment model was Raspberry Pi plus Tailscale. Vercel deployments are public unless Vercel deployment protection or application auth is configured. The app stores customer names, contact fields, addresses, prices, notes, and photos.

Production fix: enable Vercel protection for private previews, or add application authentication before using a public production URL.

### CORS Is Open

The Express app uses `cors()` with default open behavior. This is unnecessary for same-origin Vercel hosting and should be restricted if the app becomes public.

Production fix: restrict CORS to same-origin or configured `CLIENT_ORIGIN` values when auth/storage work is done.

## Required Vercel Settings

- Root Directory: repository root.
- Framework Preset: Vite, or allow `vercel.json` to override it.
- Build Command: let `vercel.json` control it.
- Install Command: let `vercel.json` control it.
- Output Directory: let `vercel.json` control it as `client/dist`.
- Redeploy once with Clear Build Cache after changing install/build commands.

## Verification Commands

Run locally from the repository root:

```sh
npm install --workspaces --include-workspace-root --include=dev
npm run build --workspace=client
npm run test:server
```

## Cutover Plan For Production-Ready Vercel

1. Stabilize build and static/API routing with the current `vercel.json`.
2. Clear Vercel build cache and deploy from the latest `master` commit.
3. Confirm `/`, a deep SPA route such as `/archive`, and `/api/health` work.
4. Choose durable storage for database and photos.
5. Add a new database adapter and migration/export/import path.
6. Add durable upload storage and update photo serving URLs.
7. Add auth or enable Vercel deployment protection before public production use.
8. Re-run API route tests against the durable database adapter.
