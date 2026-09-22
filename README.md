# moood — Cloud Sync Worker

Cloudflare Worker API for synchronizing the Abu Oreiban camp application across devices using Cloudflare D1.

## Files
- `wrangler.toml` — Worker `moood` + D1 binding `DB` → database `mood`.
- `index.js` — API endpoints for health, pull, push, and first-time bootstrap.
- `schema.sql` — D1 schema.

## Endpoints
- `GET /` or `GET /health` — health check.
- `GET /sync/pull?since=0` — fetch changes after a sequence cursor.
- `POST /sync/push` — upload local changes.
- `POST /sync/bootstrap` — first-time seed only when the database is empty.

## First deployment
1. Commit these files to the GitHub repository used by the Worker.
2. Deploy the Worker from Cloudflare/GitHub.
3. Open the Worker URL. It should return JSON showing `worker: moood`, `database: mood`, and a record count.
4. The Worker creates the tables automatically on first request. `schema.sql` is also supplied for explicit D1 migrations.

## Security
For production use, configure a Worker secret named `SYNC_API_KEY` and have the app send it as:
`Authorization: Bearer <key>`.

Do not hard-code a permanent API key inside the public HTML. A browser-embedded key is not a true secret.

## Important
This package provides the cloud API/database layer. The HTML application still needs its local save/load layer connected to these endpoints so that add/edit/delete/import/restore operations enter the sync queue and other devices pull them.
