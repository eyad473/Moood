# moood — V16 app + D1 cloud sync on the same Worker URL

This package serves the V16 `index.html` UI from the same Worker URL while preserving the D1 sync API.

- `/` → V16 application UI
- `/health` → Worker/D1 health JSON
- `/sync/pull` → sync pull API
- `/sync/push` → sync push API
- `/sync/bootstrap` → first bootstrap API

Deploy the whole folder with Wrangler or use the GitHub-connected Worker with this structure.

D1 binding must remain `DB` and database `mood`.
