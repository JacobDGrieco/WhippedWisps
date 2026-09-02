# Whipped Wisps

Personal cake-order scheduler and archive, self-hosted as a Docker container.

## Production deployment

The repository is split into:

- `/opt/homelab/whippedwisps/app` — application source and Docker build context
- `/opt/homelab/whippedwisps/data` — database, uploads, secrets, and migration backups
- `/opt/homelab/whippedwisps/docker-compose.yml` — host deployment definition

Create `/opt/homelab/whippedwisps/data/secrets.env` from `.env.example`. The production values should include:

```sh
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://homelab-gaminglegion.taile3eaea.ts.net:5253/api/settings/calendar/callback
CALENDAR_NAME=Whipped Wisps Orders
TIME_ZONE=America/New_York
```

The same callback URI must be registered on the OAuth client in Google Cloud.

From `/opt/homelab/whippedwisps`:

```sh
docker compose build
docker compose up -d
docker compose ps
docker compose logs -f whippedwisps
```

Open `https://homelab-gaminglegion.taile3eaea.ts.net:5253`. The container listens on port 3001 and Docker publishes it on host port 5253.

To deploy an update:

```sh
cd /opt/homelab/whippedwisps/app
git pull
cd ..
docker compose build
docker compose up -d
```

The health endpoint is `/api/health`. Stop the service with `docker compose down`; persistent data remains in the host data directory.

## Persistent data and backups

The container uses:

```sh
DB_PATH=/data/whippedwisps.db
UPLOADS_DIR=/data/uploads
```

The entire host directory `/opt/homelab/whippedwisps/data` is mounted at `/data`. Back up `whippedwisps.db`, its optional WAL/SHM files, `uploads/`, and `secrets.env` to separate storage. For a consistent live SQLite backup, stop the container or use SQLite's backup command rather than copying only the main database while writes are active.

## Local development

Use Node.js 22:

```sh
npm install
npm run dev
```

The Vite client runs on `http://localhost:5173` and proxies `/api` and `/uploads` to the Express server on port 3001. A repo-root ignored `.env` may be used for local Google Calendar testing. If Vite uses another port, set `CLIENT_ORIGIN` accordingly.

Run checks with:

```sh
npm run test:server
npm run build:client
```
