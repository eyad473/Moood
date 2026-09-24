const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

const ALLOWED_ORIGIN = "*";

const MAX_PUSH = 200;
const MAX_PULL = 500;
const MAX_BOOTSTRAP = 2000;

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...JSON_HEADERS,
      "access-control-allow-origin": ALLOWED_ORIGIN,
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers":
        "Content-Type, Authorization, X-Device-Id",
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
    return {
      ok: true,
      deviceId: cleanString(
        request.headers.get("X-Device-Id"),
        120
      )
    };
  }

  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ")
    ? auth.slice(7)
    : "";

  if (token !== env.SYNC_API_KEY) {
    return {
      ok: false,
      error: "غير مصرح"
    };
  }

  return {
    ok: true,
    deviceId: cleanString(
      request.headers.get("X-Device-Id"),
      120
    )
  };
}

function validRecord(item) {
  if (!item || typeof item !== "object") return false;

  const id = cleanString(item.recordId, 200);
  if (!id) return false;

  const updatedAt = Number(item.updatedAt);

  return Number.isFinite(updatedAt) && updatedAt > 0;
}

function parseJSON(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

let schemaReady = false;

async function ensureSchema(env) {
  if (schemaReady) return;

  await env.DB.batch([
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS sync_records (
        record_id TEXT PRIMARY KEY,
        data_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        deleted INTEGER NOT NULL DEFAULT 0,
        updated_by TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS sync_changes (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        op_id TEXT NOT NULL UNIQUE,
        record_id TEXT NOT NULL,
        operation TEXT NOT NULL
          CHECK (operation IN ('upsert','delete')),
        data_json TEXT,
        updated_at INTEGER NOT NULL,
        version INTEGER NOT NULL,
        device_id TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS sync_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `),

    env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_sync_changes_record
      ON sync_changes(record_id)
    `),

    env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_sync_changes_seq
      ON sync_changes(seq)
    `),

    env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_sync_records_updated
      ON sync_records(updated_at)
    `)
  ]);

  try {
    const existing = await env.DB.prepare(`
      SELECT key
      FROM sync_meta
      WHERE key IN (
        'records_count',
        'active_records_count',
        'latest_seq'
      )
    `).all();

    const keys = new Set(
      (existing.results || []).map(x => String(x.key))
    );

    const statements = [];

    if (!keys.has("records_count")) {
      statements.push(
        env.DB.prepare(`
          INSERT OR IGNORE INTO sync_meta(key,value)
          SELECT 'records_count', CAST(COUNT(*) AS TEXT)
          FROM sync_records
        `)
      );
    }

    if (!keys.has("active_records_count")) {
      statements.push(
        env.DB.prepare(`
          INSERT OR IGNORE INTO sync_meta(key,value)
          SELECT 'active_records_count',
                 CAST(COUNT(*) AS TEXT)
          FROM sync_records
          WHERE deleted = 0
        `)
      );
    }

    if (!keys.has("latest_seq")) {
      statements.push(
        env.DB.prepare(`
          INSERT OR IGNORE INTO sync_meta(key,value)
          SELECT 'latest_seq',
                 CAST(COALESCE(MAX(seq),0) AS TEXT)
          FROM sync_changes
        `)
      );
    }

    if (statements.length) {
      await env.DB.batch(statements);
    }
  } catch {}

  schemaReady = true;
}

async function getMeta(env, key, fallback = "0") {
  const row = await env.DB.prepare(`
    SELECT value
    FROM sync_meta
    WHERE key = ?
    LIMIT 1
  `).bind(key).first();

  return row?.value ?? fallback;
}

async function setMeta(env, key, value) {
  await env.DB.prepare(`
    INSERT INTO sync_meta(key,value)
    VALUES(?,?)
    ON CONFLICT(key)
    DO UPDATE SET value = excluded.value
  `).bind(
    key,
    String(value)
  ).run();
}

async function health(env) {
  try {
    await ensureSchema(env);

    const rows = await env.DB.prepare(`
      SELECT key,value
      FROM sync_meta
      WHERE key IN (
        'records_count',
        'active_records_count',
        'latest_seq'
      )
    `).all();

    const meta = {};

    for (const row of rows.results || []) {
      meta[String(row.key)] = Number(row.value || 0);
    }

    return json({
      ok: true,
      worker: "moood",
      database: "mood",
      binding: "DB",
      records: meta.records_count || 0,
      activeRecords: meta.active_records_count || 0,
      latestSeq: meta.latest_seq || 0,
      time: new Date().toISOString(),
      syncVersion: "V49"
    });

  } catch (e) {
    return json({
      ok: false,
      error: "D1 غير جاهزة",
      detail: String(e?.message || e)
    }, 500);
  }
}

async function pull(request, env) {
  const auth = requireAuth(request, env);

  if (!auth.ok) {
    return json({
      ok: false,
      error: auth.error
    }, 401);
  }

  await ensureSchema(env);

  const url = new URL(request.url);

  const sinceRaw = Number(
    url.searchParams.get("since") || 0
  );

  const since = Number.isFinite(sinceRaw)
    ? Math.max(0, Math.floor(sinceRaw))
    : 0;

  const limitRaw = Number(
    url.searchParams.get("limit") || MAX_PULL
  );

  const limit = Math.min(
    MAX_PULL,
    Math.max(
      1,
      Number.isFinite(limitRaw)
        ? Math.floor(limitRaw)
        : MAX_PULL
    )
  );

  const scope = cleanString(
    url.searchParams.get("scope"),
    40
  );

  let query = `
    SELECT
      seq,
      record_id,
      operation,
      data_json,
      updated_at,
      version,
      device_id,
      created_at
    FROM sync_changes
    WHERE seq > ?
  `;

  const binds = [since];

  if (scope === "distributions") {
    query += ` AND record_id LIKE ?`;
    binds.push("dist:%");
  }

  if (scope === "records") {
    query += ` AND record_id LIKE ?`;
    binds.push("r-%");
  }

  query += `
    ORDER BY seq ASC
    LIMIT ?
  `;

  binds.push(limit);

  const result = await env.DB
    .prepare(query)
    .bind(...binds)
    .all();

  const changes = (result.results || []).map(row => ({
    seq: Number(row.seq),
    recordId: row.record_id,
    operation: row.operation,
    data: parseJSON(row.data_json, null),
    updatedAt: Number(row.updated_at),
    version: Number(row.version),
    deviceId: row.device_id,
    createdAt: Number(row.created_at)
  }));

  const nextSince = changes.length
    ? changes[changes.length - 1].seq
    : since;

  const globalLatest = Number(
    await getMeta(
      env,
      "latest_seq",
      String(nextSince)
    )
  );

  return json({
    ok: true,
    since,
    latestSeq: globalLatest,
    nextSince,
    hasMore: changes.length === limit,
    changes,
    syncVersion: "V49"
  });
}

async function push(request, env) {
  const auth = requireAuth(request, env);

  if (!auth.ok) {
    return json({
      ok: false,
      error: auth.error
    }, 401);
  }

  await ensureSchema(env);

  let body;

  try {
    body = await request.json();
  } catch {
    return json({
      ok: false,
      error: "بيانات JSON غير صالحة"
    }, 400);
  }

  const deviceId = cleanString(
    body.deviceId || auth.deviceId,
    120
  );

  const incoming = Array.isArray(body.changes)
    ? body.changes
    : [];

  if (incoming.length > MAX_PUSH) {
    return json({
      ok: false,
      error: `الحد الأقصى ${MAX_PUSH} تغيير في الطلب الواحد`
    }, 413);
  }

  if (!incoming.length) {
    return json({
      ok: true,
      accepted: [],
      conflicts: [],
      skipped: [],
      latestSeq: Number(
        await getMeta(env, "latest_seq", "0")
      )
    });
  }

  const accepted = [];
  const conflicts = [];
  const skipped = [];
  const validItems = [];

  for (const item of incoming) {
    if (!validRecord(item)) {
      skipped.push({
        opId: item?.opId || null,
        recordId: item?.recordId || null,
        reason: "recordId/updatedAt غير صالح"
      });
      continue;
    }

    const opId = cleanString(item.opId, 200);
    const recordId = cleanString(item.recordId, 200);

    if (!opId) {
      skipped.push({
        recordId,
        reason: "opId مفقود"
      });
      continue;
    }

    validItems.push({
      item,
      opId,
      recordId
    });
  }

  const CHUNK = 50;

  for (let start = 0; start < validItems.length; start += CHUNK) {
    const chunk = validItems.slice(start, start + CHUNK);

    const opPlaceholders = chunk.map(() => "?").join(",");

    const opRows = await env.DB.prepare(`
      SELECT
        op_id,
        seq,
        record_id,
        operation,
        updated_at,
        version
      FROM sync_changes
      WHERE op_id IN (${opPlaceholders})
    `)
      .bind(...chunk.map(x => x.opId))
      .all();

    const existingOps = new Map();

    for (const row of opRows.results || []) {
      existingOps.set(String(row.op_id), row);
    }

    const newItems = [];

    for (const entry of chunk) {
      const already = existingOps.get(entry.opId);

      if (!already) {
        newItems.push(entry);
        continue;
      }

      if (
        String(already.record_id) !==
        entry.recordId
      ) {
        conflicts.push({
          opId: entry.opId,
          recordId: entry.recordId,
          reason: "opId مستخدم لسجل مختلف",
          serverRecordId: already.record_id
        });
        continue;
      }

      accepted.push({
        opId: entry.opId,
        recordId: entry.recordId,
        version: Number(already.version),
        updatedAt: Number(already.updated_at),
        operation: already.operation,
        idempotent: true,
        seq: Number(already.seq)
      });
    }

    if (!newItems.length) continue;

    const recordPlaceholders = newItems.map(() => "?").join(",");

    const currentRows = await env.DB.prepare(`
      SELECT
        record_id,
        updated_at,
        version,
        deleted,
        data_json
      FROM sync_records
      WHERE record_id IN (${recordPlaceholders})
    `)
      .bind(...newItems.map(x => x.recordId))
      .all();

    const currentMap = new Map();

    for (const row of currentRows.results || []) {
      currentMap.set(String(row.record_id), row);
    }

    const statements = [];

    for (const entry of newItems) {
      const item = entry.item;

      const operation =
        item.operation === "delete"
          ? "delete"
          : "upsert";

      const updatedAt = Number(item.updatedAt);
      const baseVersion = Number(item.baseVersion || 0);

      const data =
        operation === "delete"
          ? null
          : (item.data ?? {});

      const current = currentMap.get(entry.recordId);

      if (!current) {
        const nextVersion = 1;
        const createdAt = now();

        const dataJson =
          operation === "delete"
            ? null
            : JSON.stringify(data);

        statements.push(
          env.DB.prepare(`
            INSERT INTO sync_records
            (
              record_id,
              data_json,
              updated_at,
              version,
              deleted,
              updated_by,
              created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).bind(
            entry.recordId,
            dataJson ?? "{}",
            updatedAt,
            nextVersion,
            operation === "delete" ? 1 : 0,
            deviceId,
            createdAt
          )
        );

        statements.push(
          env.DB.prepare(`
            INSERT INTO sync_changes
            (
              op_id,
              record_id,
              operation,
              data_json,
              updated_at,
              version,
              device_id,
              created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            entry.opId,
            entry.recordId,
            operation,
            dataJson,
            updatedAt,
            nextVersion,
            deviceId,
            createdAt
          )
        );

        accepted.push({
          opId: entry.opId,
          recordId: entry.recordId,
          version: nextVersion,
          updatedAt,
          operation
        });

        continue;
      }

      if (
        baseVersion !==
        Number(current.version)
      ) {
        conflicts.push({
          opId: entry.opId,
          recordId: entry.recordId,
          reason: "تعارض إصدار — توجد تعديلات أحدث على الخادم",
          serverUpdatedAt: Number(current.updated_at),
          serverVersion: Number(current.version),
          serverData:
            Number(current.deleted) === 0
              ? parseJSON(current.data_json, null)
              : null,
          serverDeleted:
            Number(current.deleted) === 1
        });

        continue;
      }

      const nextVersion = Number(current.version) + 1;
      const createdAt = now();

      const dataJson =
        operation === "delete"
          ? null
          : JSON.stringify(data);

      statements.push(
        env.DB.prepare(`
          UPDATE sync_records
          SET
            data_json = ?,
            updated_at = ?,
            version = ?,
            deleted = ?,
            updated_by = ?
          WHERE record_id = ?
        `).bind(
          dataJson ?? "{}",
          updatedAt,
          nextVersion,
          operation === "delete" ? 1 : 0,
          deviceId,
          entry.recordId
        )
      );

      statements.push(
        env.DB.prepare(`
          INSERT INTO sync_changes
          (
            op_id,
            record_id,
            operation,
            data_json,
            updated_at,
            version,
            device_id,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          entry.opId,
          entry.recordId,
          operation,
          dataJson,
          updatedAt,
          nextVersion,
          deviceId,
          createdAt
        )
      );

      accepted.push({
        opId: entry.opId,
        recordId: entry.recordId,
        version: nextVersion,
        updatedAt,
        operation
      });
    }

    if (statements.length) {
      try {
        await env.DB.batch(statements);
      } catch (e) {
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
  }

  let latestSeq = Number(
    await getMeta(env, "latest_seq", "0")
  );

  if (accepted.length) {
    const seqs = accepted
      .map(x => Number(x.seq || 0))
      .filter(x => x > 0);

    if (seqs.length) {
      latestSeq = Math.max(latestSeq, ...seqs);
    }

    if (
      accepted.some(
        x => !Number(x.seq || 0)
      )
    ) {
      const latest = await env.DB
        .prepare(`
          SELECT seq
          FROM sync_changes
          ORDER BY seq DESC
          LIMIT 1
        `)
        .first();

      latestSeq = Math.max(
        latestSeq,
        Number(latest?.seq || 0)
      );
    }
  }

  await setMeta(env, "latest_seq", latestSeq);

  return json({
    ok: true,
    accepted,
    conflicts,
    skipped,
    latestSeq,
    syncVersion: "V49"
  });
}

async function bootstrap(request, env) {
  const auth = requireAuth(request, env);

  if (!auth.ok) {
    return json({
      ok: false,
      error: auth.error
    }, 401);
  }

  await ensureSchema(env);

  const existingCount = Number(
    await getMeta(
      env,
      "records_count",
      "0"
    )
  );

  if (existingCount > 0) {
    return json({
      ok: false,
      error: "قاعدة البيانات تحتوي بيانات بالفعل؛ لم يتم استبدالها"
    }, 409);
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return json({
      ok: false,
      error: "JSON غير صالح"
    }, 400);
  }

  const records =
    Array.isArray(body.records)
      ? body.records
      : [];

  if (!records.length) {
    return json({
      ok: false,
      error: "لا توجد سجلات"
    }, 400);
  }

  if (records.length > MAX_BOOTSTRAP) {
    return json({
      ok: false,
      error: `عدد السجلات كبير؛ الحد ${MAX_BOOTSTRAP}`
    }, 413);
  }

  const deviceId = cleanString(
    body.deviceId || auth.deviceId,
    120
  );

  let inserted = 0;
  let ignored = 0;
  const t = now();

  for (let i = 0; i < records.length; i += 50) {
    const chunk = records.slice(i, i + 50);
    const statements = [];

    for (const item of chunk) {
      if (!validRecord(item)) {
        ignored++;
        continue;
      }

      const recordId = cleanString(item.recordId, 200);
      const updatedAt = Number(item.updatedAt);
      const dataJson = JSON.stringify(item.data ?? {});
      const opId = cleanString(
        item.opId || crypto.randomUUID(),
        200
      );
      const version = Math.max(
        1,
        Number(item.version || 1)
      );
      const operation = item.deleted ? "delete" : "upsert";

      statements.push(
        env.DB.prepare(`
          INSERT OR IGNORE INTO sync_records
          (
            record_id,
            data_json,
            updated_at,
            version,
            deleted,
            updated_by,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          recordId,
          dataJson,
          updatedAt,
          version,
          item.deleted ? 1 : 0,
          deviceId,
          t
        )
      );

      statements.push(
        env.DB.prepare(`
          INSERT OR IGNORE INTO sync_changes
          (
            op_id,
            record_id,
            operation,
            data_json,
            updated_at,
            version,
            device_id,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          opId,
          recordId,
          operation,
          item.deleted ? null : dataJson,
          updatedAt,
          version,
          deviceId,
          t
        )
      );

      inserted++;
    }

    if (statements.length) {
      await env.DB.batch(statements);
    }
  }

  const latest = await env.DB
    .prepare(`
      SELECT seq
      FROM sync_changes
      ORDER BY seq DESC
      LIMIT 1
    `)
    .first();

  const latestSeq = Number(latest?.seq || 0);

  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO sync_meta(key,value)
      VALUES('records_count',?)
      ON CONFLICT(key)
      DO UPDATE SET value = excluded.value
    `).bind(inserted),

    env.DB.prepare(`
      INSERT INTO sync_meta(key,value)
      VALUES('active_records_count',?)
      ON CONFLICT(key)
      DO UPDATE SET value = excluded.value
    `).bind(inserted),

    env.DB.prepare(`
      INSERT INTO sync_meta(key,value)
      VALUES('latest_seq',?)
      ON CONFLICT(key)
      DO UPDATE SET value = excluded.value
    `).bind(latestSeq)
  ]);

  return json({
    ok: true,
    inserted,
    ignored,
    latestSeq,
    syncVersion: "V49"
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
          "access-control-allow-headers":
            "Content-Type, Authorization, X-Device-Id"
        }
      });
    }

    const url = new URL(request.url);

    try {

      if (url.pathname === "/health") {
        return await health(env);
      }

      if (
        url.pathname === "/sync/pull" &&
        request.method === "GET"
      ) {
        return await pull(request, env);
      }

      if (
        url.pathname === "/sync/push" &&
        request.method === "POST"
      ) {
        return await push(request, env);
      }

      if (
        url.pathname === "/sync/bootstrap" &&
        request.method === "POST"
      ) {
        return await bootstrap(request, env);
      }

      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }

      return json({
        ok: false,
        error: "واجهة التطبيق غير مفعلة: اربط Static Assets"
      }, 404);

    } catch (e) {

      return json({
        ok: false,
        error: "خطأ داخلي",
        detail: String(e?.message || e),
        syncVersion: "V49"
      }, 500);
    }
  }
};
