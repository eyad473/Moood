# نسخة استعادة V16 — Mood

هذه النسخة تعيد تطبيق V16 كما هو مع واجهة التطبيق داخل `public/index.html`.

الترتيب المطلوب في GitHub:

- `index.js`
- `wrangler.toml`
- `schema.sql`
- `public/index.html`

إعدادات Cloudflare:
- Repository: `eyad473/Moood`
- Branch: `main`
- Root directory: `/` (جذر المستودع)
- Build command: فارغ / None
- Deploy command: `npx wrangler deploy`
- D1 binding: `DB` → `mood`
- Assets binding: `ASSETS`

لا تضع `index.html` في جذر المستودع؛ يجب أن يكون داخل `public`.
