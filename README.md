# Whipped Wisps

Personal cake order scheduler and archive, self-hosted on a Raspberry Pi 5 and accessed over Tailscale.

## Local Development

```sh
npm install
npm run dev:server
npm run dev:client
```

The Vite app runs on `http://localhost:5173` and proxies `/api` plus `/uploads` to the Express server on port `3001`.

## Runtime Data

Set these environment variables in production:

```sh
DB_PATH=/home/pi/whippedwisps-data/whippedwisps.db
UPLOADS_DIR=/home/pi/whippedwisps-data/uploads
```

The local defaults are `./data/whippedwisps.db` and `./data/uploads`.

## Google Calendar Setup

1. Create a Google Cloud project, enable Calendar API, and create an OAuth 2.0 Web application client.
2. Add `http://<your-pi-tailnet-hostname>:3001/api/settings/calendar/callback` as an authorized redirect URI.
3. Create `/home/pi/whippedwisps-data/secrets.env` with:

```sh
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://<your-pi-tailnet-hostname>:3001/api/settings/calendar/callback
CALENDAR_NAME=Whipped Wisps Orders
TIME_ZONE=America/New_York
```

4. Visit `/settings` and connect Google Calendar.

Calendar sync failures do not block saving order data; the order API returns a warning that the UI can surface.

## Pi Deployment

```sh
git clone <repo> /home/pi/whippedwisps
mkdir -p /home/pi/whippedwisps-data/uploads
cd /home/pi/whippedwisps
npm install
npm run build:client
sudo cp whippedwisps.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now whippedwisps
```

Join the Pi to Tailscale and open `http://<pi-tailnet-hostname>:3001`.

## Backups

Use cron or another local backup mechanism to copy `/home/pi/whippedwisps-data/whippedwisps.db` and `/home/pi/whippedwisps-data/uploads/` daily to separate storage.
