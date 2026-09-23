const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

const ALLOWED_ORIGIN = "*";

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...JSON_HEADERS,
      "access-control-allow-origin": ALLOWED_ORIGIN,
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "Content-Type, Authorization, X-Device-Id",
      ...extra
    }
  });
}

function now() {
  return Date.now();
}

function cleanString(value, max = 200) {
  return String(value ?? "").trim().slice(0, max);
}

function requireAuth(request, env) {
  if (!env.SYNC_API_KEY) {
    return { ok: true, deviceId: cleanString(request.headers.get("X-Device-Id"), 120) };
  }
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token !== env.SYNC_API_KEY) return { ok: false, error: "غير مصرح" };
  return { ok: true, deviceId: cleanString(request.headers.get("X-Device-Id"), 120) };
}

function validRecord(item) {
  if (!item || typeof item !== "object") return false;
  const id = cleanString(item.recordId, 200);
  if (!id) return false;
  const updatedAt = Number(item.updatedAt);
  return Number.isFinite(updatedAt) && updatedAt > 0;
}

async function ensureSchema(env) {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS sync_records (
      record_id TEXT PRIMARY KEY,
      data_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      deleted INTEGER NOT NULL DEFAULT 0,
      updated_by TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS sync_changes (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      op_id TEXT NOT NULL UNIQUE,
      record_id TEXT NOT NULL,
      operation TEXT NOT NULL CHECK (operation IN ('upsert','delete')),
      data_json TEXT,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL,
      device_id TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_sync_changes_seq ON sync_changes(seq)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_sync_records_updated ON sync_records(updated_at)`)
  ]);
}

async function health(env) {
  try {
    await ensureSchema(env);
    const row = await env.DB.prepare("SELECT COUNT(*) AS count FROM sync_records").first();
    const live = await env.DB.prepare("SELECT COUNT(*) AS count FROM sync_records WHERE deleted = 0").first();
    const change = await env.DB.prepare("SELECT COALESCE(MAX(seq),0) AS seq FROM sync_changes").first();
    return json({
      ok: true,
      worker: "moood",
      database: "mood",
      binding: "DB",
      records: Number(row?.count || 0),
      activeRecords: Number(live?.count || 0),
      latestSeq: Number(change?.seq || 0),
      time: new Date().toISOString()
    });
  } catch (e) {
    return json({ ok: false, error: "D1 غير جاهزة", detail: String(e?.message || e) }, 500);
  }
}

async function pull(request, env) {
  const auth = requireAuth(request, env);
  if (!auth.ok) return json({ ok: false, error: auth.error }, 401);

  await ensureSchema(env);
  const url = new URL(request.url);
  const since = Math.max(0, Number(url.searchParams.get("since") || 0));
  const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get("limit") || 500)));

  const scope = cleanString(url.searchParams.get("scope"), 40);
  const prefix = scope === "distributions" ? "dist:%" : scope === "records" ? "r-%" : null;
  const result = prefix
    ? await env.DB.prepare(`
      SELECT seq, record_id, operation, data_json, updated_at, version, device_id, created_at
      FROM sync_changes
      WHERE seq > ? AND record_id LIKE ?
      ORDER BY seq ASC
      LIMIT ?
    `).bind(since, prefix, limit).all()
    : await env.DB.prepare(`
      SELECT seq, record_id, operation, data_json, updated_at, version, device_id, created_at
      FROM sync_changes
      WHERE seq > ?
      ORDER BY seq ASC
      LIMIT ?
    `).bind(since, limit).all();

  const changes = (result.results || []).map(r => ({
    seq: Number(r.seq),
    recordId: r.record_id,
    operation: r.operation,
    data: r.data_json ? JSON.parse(r.data_json) : null,
    updatedAt: Number(r.updated_at),
    version: Number(r.version),
    deviceId: r.device_id,
    createdAt: Number(r.created_at)
  }));

  const nextSince = changes.length ? changes[changes.length - 1].seq : since;
  const maxRow = await env.DB.prepare("SELECT COALESCE(MAX(seq),0) AS seq FROM sync_changes").first();
  const countRow = await env.DB.prepare("SELECT COUNT(*) AS count FROM sync_records WHERE deleted = 0").first();

  return json({
    ok: true,
    since,
    latestSeq: Number(maxRow?.seq || nextSince || 0),
    nextSince,
    hasMore: changes.length === limit,
    serverActiveRecords: Number(countRow?.count || 0),
    changes
  });
}

async function push(request, env) {
  const auth = requireAuth(request, env);
  if (!auth.ok) return json({ ok: false, error: auth.error }, 401);

  await ensureSchema(env);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "بيانات JSON غير صالحة" }, 400);
  }

  const deviceId = cleanString(body.deviceId || auth.deviceId, 120);
  const incoming = Array.isArray(body.changes) ? body.changes : [];
  if (incoming.length > 200) {
    return json({ ok: false, error: "الحد الأقصى 200 تغيير في الطلب الواحد" }, 413);
  }

  const accepted = [];
  const conflicts = [];
  const skipped = [];
  const statements = [];

  for (const item of incoming) {
    if (!validRecord(item)) {
      skipped.push({ opId: item?.opId || null, reason: "recordId/updatedAt غير صالح" });
      continue;
    }

    const opId = cleanString(item.opId, 200);
    const recordId = cleanString(item.recordId, 200);
    const operation = item.operation === "delete" ? "delete" : "upsert";
    const updatedAt = Number(item.updatedAt);
    const baseVersion = Number(item.baseVersion || 0);
    const data = operation === "delete" ? null : (item.data ?? {});

    if (!opId) {
      skipped.push({ recordId, reason: "opId مفقود" });
      continue;
    }

    // Idempotency: if this exact operation already reached D1, report it as accepted.
    // This is important after an internet drop: the browser may retry a request that
    // the Worker already committed. It must not stay pending forever.
    const already = await env.DB.prepare(`
      SELECT seq, record_id, operation, updated_at, version
      FROM sync_changes
      WHERE op_id = ?
    `).bind(opId).first();

    if (already) {
      if (String(already.record_id) !== recordId) {
        conflicts.push({
          opId,
          recordId,
          reason: "opId مستخدم لسجل مختلف",
          serverRecordId: already.record_id
        });
      } else {
        accepted.push({
          opId,
          recordId,
          version: Number(already.version),
          updatedAt: Number(already.updated_at),
          operation: already.operation,
          idempotent: true,
          seq: Number(already.seq)
        });
      }
      continue;
    }

    const current = await env.DB.prepare(`
      SELECT record_id, updated_at, version, deleted
      FROM sync_records WHERE record_id = ?
    `).bind(recordId).first();

    if (current && baseVersion !== Number(current.version)) {
      let serverData = null;
      if (Number(current.deleted) === 0) {
        const sr = await env.DB.prepare(`SELECT data_json FROM sync_records WHERE record_id = ?`).bind(recordId).first();
        try { serverData = sr?.data_json ? JSON.parse(sr.data_json) : null; } catch { serverData = null; }
      }
      conflicts.push({
        opId,
        recordId,
        reason: "تعارض إصدار — توجد تعديلات أحدث على الخادم",
        serverUpdatedAt: Number(current.updated_at),
        serverVersion: Number(current.version),
        serverData
      });
      continue;
    }

    const nextVersion = current ? Number(current.version) + 1 : 1;
    const createdAt = now();
    const dataJson = operation === "delete" ? null : JSON.stringify(data);

    statements.push(
      env.DB.prepare(`
        INSERT INTO sync_records
          (record_id, data_json, updated_at, version, deleted, updated_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(record_id) DO UPDATE SET
          data_json = excluded.data_json,
          updated_at = excluded.updated_at,
          version = excluded.version,
          deleted = excluded.deleted,
          updated_by = excluded.updated_by
      `).bind(
        recordId,
        dataJson ?? "{}",
        updatedAt,
        nextVersion,
        operation === "delete" ? 1 : 0,
        deviceId,
        createdAt
      ),
      env.DB.prepare(`
        INSERT INTO sync_changes
          (op_id, record_id, operation, data_json, updated_at, version, device_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        opId,
        recordId,
        operation,
        dataJson,
        updatedAt,
        nextVersion,
        deviceId,
        createdAt
      )
    );

    accepted.push({ opId, recordId, version: nextVersion, updatedAt, operation });
  }

  if (statements.length) {
    try {
      await env.DB.batch(statements);
    } catch (e) {
      // Nothing is reported as accepted if the atomic D1 batch failed.
      return json({
        ok: false,
        error: "فشل حفظ دفعة المزامنة في D1",
        detail: String(e?.message || e),
        accepted: [],
        conflicts,
        skipped
      }, 500);
    }
  }

  const latest = await env.DB.prepare("SELECT COALESCE(MAX(seq),0) AS seq FROM sync_changes").first();
  const live = await env.DB.prepare("SELECT COUNT(*) AS count FROM sync_records WHERE deleted = 0").first();

  return json({
    ok: true,
    accepted,
    conflicts,
    skipped,
    latestSeq: Number(latest?.seq || 0),
    serverActiveRecords: Number(live?.count || 0)
  });
}

async function bootstrap(request, env) {
  const auth = requireAuth(request, env);
  if (!auth.ok) return json({ ok: false, error: auth.error }, 401);

  await ensureSchema(env);
  const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM sync_records").first();
  if (Number(count?.count || 0) > 0) {
    return json({ ok: false, error: "قاعدة البيانات تحتوي بيانات بالفعل؛ لم يتم استبدالها" }, 409);
  }

  let body;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: "JSON غير صالح" }, 400); }

  const records = Array.isArray(body.records) ? body.records : [];
  if (!records.length) return json({ ok: false, error: "لا توجد سجلات" }, 400);
  if (records.length > 2000) return json({ ok: false, error: "عدد السجلات كبير؛ أرسلها على دفعات" }, 413);

  const deviceId = cleanString(body.deviceId || auth.deviceId, 120);
  let inserted = 0;
  let ignored = 0;
  const t = now();

  for (let i = 0; i < records.length; i += 100) {
    const chunk = records.slice(i, i + 100);
    const statements = [];

    for (const item of chunk) {
      if (!validRecord(item)) {
        ignored++;
        continue;
      }

      const recordId = cleanString(item.recordId, 200);
      const updatedAt = Number(item.updatedAt);
      const dataJson = JSON.stringify(item.data ?? {});
      const opId = cleanString(item.opId || crypto.randomUUID(), 200);
      const version = Math.max(1, Number(item.version || 1));
      const operation = item.deleted ? "delete" : "upsert";

      statements.push(
        env.DB.prepare(`INSERT OR IGNORE INTO sync_records
          (record_id, data_json, updated_at, version, deleted, updated_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .bind(recordId, dataJson, updatedAt, version, item.deleted ? 1 : 0, deviceId, t),
        env.DB.prepare(`INSERT OR IGNORE INTO sync_changes
          (op_id, record_id, operation, data_json, updated_at, version, device_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(opId, recordId, operation, item.deleted ? null : dataJson, updatedAt, version, deviceId, t)
      );
    }

    if (statements.length) {
      await env.DB.batch(statements);
      inserted += statements.length / 2;
    }
  }

  const latest = await env.DB.prepare("SELECT COALESCE(MAX(seq),0) AS seq FROM sync_changes").first();
  return json({
    ok: true,
    inserted,
    ignored,
    latestSeq: Number(latest?.seq || 0)
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": ALLOWED_ORIGIN,
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "Content-Type, Authorization, X-Device-Id"
        }
      });
    }

    const url = new URL(request.url);
    try {
      if (url.pathname === "/health") return await health(env);
      if (url.pathname === "/sync/pull" && request.method === "GET") return await pull(request, env);
      if (url.pathname === "/sync/push" && request.method === "POST") return await push(request, env);
      if (url.pathname === "/sync/bootstrap" && request.method === "POST") return await bootstrap(request, env);
      if (env.ASSETS) return await env.ASSETS.fetch(request);
      return json({ ok: false, error: "واجهة التطبيق غير مفعلة: اربط Static Assets" }, 404);
    } catch (e) {
      return json({ ok: false, error: "خطأ داخلي", detail: String(e?.message || e) }, 500);
    }
  }
};
