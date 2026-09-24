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


async function hashText(text){const bytes=new TextEncoder().encode(String(text||""));const digest=await crypto.subtle.digest("SHA-256",bytes);return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("")}
function randomToken(){return crypto.randomUUID()+"-"+crypto.randomUUID()}
async function ensureAuthSchema(env){await ensureSchema(env);await env.DB.batch([env.DB.prepare(`CREATE TABLE IF NOT EXISTS display_accounts (id INTEGER PRIMARY KEY AUTOINCREMENT,full_name TEXT NOT NULL,username TEXT NOT NULL UNIQUE,password_salt TEXT NOT NULL,password_hash TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,last_login_at INTEGER,session_hash TEXT,session_expires_at INTEGER)`),env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_display_accounts_enabled ON display_accounts(enabled)`),env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_display_accounts_session ON display_accounts(session_hash)`)])}
async function displaySession(request,env){await ensureAuthSchema(env);const auth=request.headers.get("Authorization")||"";const token=auth.startsWith("Bearer ")?auth.slice(7):"";if(!token)return {ok:false,error:"تسجيل الدخول مطلوب",code:"DISPLAY_AUTH_REQUIRED"};const sh=await hashText(token);const row=await env.DB.prepare(`SELECT id,full_name,username,enabled,session_expires_at FROM display_accounts WHERE session_hash=? LIMIT 1`).bind(sh).first();if(!row)return {ok:false,error:"جلسة الدخول غير صالحة",code:"DISPLAY_AUTH_REQUIRED"};if(Number(row.enabled)!==1)return {ok:false,error:"تم إيقاف حساب جهاز العرض من الجهاز الرئيسي",code:"DISPLAY_DISABLED"};if(Number(row.session_expires_at||0)<now())return {ok:false,error:"انتهت جلسة الدخول، سجّل الدخول من جديد",code:"DISPLAY_AUTH_REQUIRED"};return {ok:true,accountId:Number(row.id),fullName:cleanString(row.full_name,200),username:cleanString(row.username,120)}}
async function requireDisplayOrPrimary(request,env){const p=await requirePrimaryDevice(request,env);if(p.ok)return {...p,role:"primary"};const d=await displaySession(request,env);if(d.ok)return {...d,role:"display"};return {ok:false,error:d.error,code:d.code||p.code||"AUTH"}}
async function displayLogin(request,env){await ensureAuthSchema(env);let body;try{body=await request.json()}catch{return json({ok:false,error:"بيانات الدخول غير صالحة"},400)}const username=cleanString(body.username,120).toLowerCase(),password=String(body.password||"");if(!username||password.length<6)return json({ok:false,error:"اسم المستخدم وكلمة المرور مطلوبان"},400);const row=await env.DB.prepare(`SELECT id,full_name,username,password_salt,password_hash,enabled FROM display_accounts WHERE username=? LIMIT 1`).bind(username).first();if(!row)return json({ok:false,error:"اسم المستخدم أو كلمة المرور غير صحيحة",code:"BAD_LOGIN"},401);if(Number(row.enabled)!==1)return json({ok:false,error:"تم إيقاف حساب جهاز العرض من الجهاز الرئيسي",code:"DISPLAY_DISABLED"},403);const check=await hashText(String(row.password_salt)+password);if(check!==String(row.password_hash))return json({ok:false,error:"اسم المستخدم أو كلمة المرور غير صحيحة",code:"BAD_LOGIN"},401);const token=randomToken(),sessionHash=await hashText(token),expires=now()+1000*60*60*24*30;await env.DB.prepare(`UPDATE display_accounts SET session_hash=?,session_expires_at=?,last_login_at=?,updated_at=? WHERE id=?`).bind(sessionHash,expires,now(),now(),Number(row.id)).run();return json({ok:true,token,expiresAt:expires,displayName:cleanString(row.full_name,200),username:cleanString(row.username,120)})}
async function displayValidate(request,env){const d=await displaySession(request,env);if(!d.ok)return json({ok:false,error:d.error,code:d.code},d.code==="DISPLAY_DISABLED"?403:401);return json({ok:true,displayName:d.fullName,username:d.username})}
async function listDisplayAccounts(request,env){const auth=await requirePrimaryDevice(request,env);if(!auth.ok)return json({ok:false,error:auth.error,code:auth.code||"AUTH"},auth.code==="READ_ONLY"?403:401);await ensureAuthSchema(env);const rows=await env.DB.prepare(`SELECT id,full_name,username,enabled,created_at,updated_at,last_login_at FROM display_accounts ORDER BY id DESC`).all();return json({ok:true,accounts:(rows.results||[]).map(r=>({id:Number(r.id),fullName:r.full_name,username:r.username,enabled:Number(r.enabled)===1,createdAt:Number(r.created_at),updatedAt:Number(r.updated_at),lastLoginAt:r.last_login_at?Number(r.last_login_at):null}))})}
async function createDisplayAccount(request,env){const auth=await requirePrimaryDevice(request,env);if(!auth.ok)return json({ok:false,error:auth.error,code:auth.code||"AUTH"},auth.code==="READ_ONLY"?403:401);await ensureAuthSchema(env);let body;try{body=await request.json()}catch{return json({ok:false,error:"JSON غير صالح"},400)}const fullName=cleanString(body.fullName,200),username=cleanString(body.username,120).toLowerCase(),password=String(body.password||"");if(fullName.length<3||username.length<3||password.length<6)return json({ok:false,error:"أدخل الاسم الرباعي واسم مستخدم من 3 أحرف على الأقل وكلمة مرور من 6 أحرف على الأقل"},400);if(!/^[a-zA-Z0-9._-]+$/.test(username))return json({ok:false,error:"اسم المستخدم يجب أن يحتوي على أحرف إنجليزية وأرقام و . _ - فقط"},400);const exists=await env.DB.prepare(`SELECT id FROM display_accounts WHERE username=? LIMIT 1`).bind(username).first();if(exists)return json({ok:false,error:"اسم المستخدم مستخدم بالفعل",code:"USERNAME_EXISTS"},409);const salt=randomToken(),ph=await hashText(salt+password),t=now();const res=await env.DB.prepare(`INSERT INTO display_accounts(full_name,username,password_salt,password_hash,enabled,created_at,updated_at) VALUES(?,?,?,?,1,?,?)`).bind(fullName,username,salt,ph,t,t).run();return json({ok:true,id:Number(res.meta?.last_row_id||0),fullName,username})}
async function setDisplayAccount(request,env){const auth=await requirePrimaryDevice(request,env);if(!auth.ok)return json({ok:false,error:auth.error,code:auth.code||"AUTH"},auth.code==="READ_ONLY"?403:401);await ensureAuthSchema(env);let body;try{body=await request.json()}catch{return json({ok:false,error:"JSON غير صالح"},400)}const id=Number(body.id||0);if(!id)return json({ok:false,error:"معرّف الحساب مفقود"},400);const exists=await env.DB.prepare(`SELECT id FROM display_accounts WHERE id=?`).bind(id).first();if(!exists)return json({ok:false,error:"حساب جهاز العرض غير موجود"},404);const enabled=body.enabled===true,password=String(body.password||"");if(password){if(password.length<6)return json({ok:false,error:"كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل"},400);const salt=randomToken(),ph=await hashText(salt+password);await env.DB.prepare(`UPDATE display_accounts SET enabled=?,password_salt=?,password_hash=?,session_hash=NULL,session_expires_at=NULL,updated_at=? WHERE id=?`).bind(enabled?1:0,salt,ph,now(),id).run()}else{if(enabled)await env.DB.prepare(`UPDATE display_accounts SET enabled=1,updated_at=? WHERE id=?`).bind(now(),id).run();else await env.DB.prepare(`UPDATE display_accounts SET enabled=0,session_hash=NULL,session_expires_at=NULL,updated_at=? WHERE id=?`).bind(now(),id).run()}return json({ok:true})}

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


async function getPrimaryDevice(env) {
  await ensureSchema(env);
  const row = await env.DB.prepare("SELECT value FROM sync_meta WHERE key = 'primary_device_id'").first();
  return cleanString(row?.value || "", 120);
}

async function getMeta(env, key) {
  await ensureSchema(env);
  const row = await env.DB.prepare("SELECT value FROM sync_meta WHERE key = ?").bind(key).first();
  return cleanString(row?.value || "", 500);
}

async function setMeta(env, key, value) {
  await env.DB.prepare("INSERT INTO sync_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(key, String(value ?? "")).run();
}

async function requirePrimaryDevice(request, env) {
  const auth = requireAuth(request, env);
  if (!auth.ok) return auth;
  const primary = await getPrimaryDevice(env);
  if (!primary) return { ok: false, error: "لم يتم تعيين جهاز رئيسي بعد", code: "NO_PRIMARY" };
  if (auth.deviceId !== primary) return { ok: false, error: "هذا الجهاز للعرض فقط؛ التعديل مسموح من الجهاز الرئيسي فقط", code: "READ_ONLY" };
  return { ok: true, deviceId: auth.deviceId, primaryDeviceId: primary };
}

async function role(request, env) {
  const auth=requireAuth(request,env); if(!auth.ok)return json({ok:false,error:auth.error},401);
  const primary=await getPrimaryDevice(env); const ready=(await getMeta(env,"authoritative_snapshot_at"))!==""; const count=Number(await getMeta(env,"authoritative_record_count")||0); const generation=Number(await getMeta(env,"authoritative_generation")||0); const isPrimary=!!primary&&auth.deviceId===primary;
  const display=await displaySession(request,env);
  if(!isPrimary && !display.ok) return json({ok:true,deviceId:auth.deviceId,primaryDeviceId:primary||null,isPrimary:false,configured:!!primary,authoritativeReady:ready,authoritativeRecordCount:count,authoritativeGeneration:generation,displayAuthenticated:false,displayAuthRequired:true},200);
  return json({ok:true,deviceId:auth.deviceId,primaryDeviceId:primary||null,isPrimary,configured:!!primary,authoritativeReady:ready,authoritativeRecordCount:count,authoritativeGeneration:generation,displayAuthenticated:!!display.ok,displayAuthRequired:false,displayName:display.ok?display.fullName:"",displayUsername:display.ok?display.username:""});
}

async function claimPrimary(request, env) {
  const auth = requireAuth(request, env);
  if (!auth.ok) return json({ ok:false, error:auth.error }, 401);
  if (!auth.deviceId) return json({ ok:false, error:"معرّف الجهاز مفقود" }, 400);
  await ensureSchema(env);
  const current = await getPrimaryDevice(env);
  if (current && current !== auth.deviceId) return json({ ok:false, error:"يوجد جهاز رئيسي محدد بالفعل", primaryDeviceId:current }, 409);
  await env.DB.prepare("INSERT INTO sync_meta(key,value) VALUES('primary_device_id',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(auth.deviceId).run();
  const ready = (await getMeta(env,"authoritative_snapshot_at")) !== "";
  return json({ ok:true, deviceId:auth.deviceId, primaryDeviceId:auth.deviceId, isPrimary:true, authoritativeReady:ready });
}

async function health(env) {
  try {
    await ensureSchema(env);
    const count = Number(await getMeta(env,"authoritative_record_count") || 0);
    const seq = Number(await getMeta(env,"latest_seq") || 0);
    const ready = (await getMeta(env,"authoritative_snapshot_at")) !== "";
    return json({
      ok: true, worker: "moood", database: "mood", binding: "DB",
      records: count, activeRecords: count, latestSeq: seq,
      authoritativeReady: ready, authoritativeGeneration:Number(await getMeta(env,"authoritative_generation") || 0), time: new Date().toISOString()
    });
  } catch (e) {
    return json({ ok: false, error: "D1 غير جاهزة", detail: String(e?.message || e) }, 500);
  }
}

async function pull(request, env) {
  const auth = await requireDisplayOrPrimary(request, env);
  if (!auth.ok) return json({ ok:false,error:auth.error,code:auth.code },auth.code==="DISPLAY_DISABLED"?403:401);

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
  return json({
    ok: true, since, latestSeq: Number(nextSince || 0), nextSince,
    hasMore: changes.length === limit, changes
  });
}

async function push(request, env) {
  const auth = await requirePrimaryDevice(request, env);
  if (!auth.ok) return json({ ok: false, error: auth.error, code: auth.code || "AUTH" }, auth.code === "READ_ONLY" ? 403 : 409);

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

  const latest = await env.DB.prepare("SELECT seq FROM sync_changes ORDER BY seq DESC LIMIT 1").first();
  await setMeta(env,"latest_seq",Number(latest?.seq||0));
  const changedRecords = accepted.some(x => String(x.recordId || "").startsWith("r-"));
  let authoritativeGeneration = Number(await getMeta(env,"authoritative_generation") || 0);
  if (changedRecords) {
    authoritativeGeneration += 1;
    await setMeta(env,"authoritative_generation", authoritativeGeneration);
    await setMeta(env,"authoritative_snapshot_at", now());
  }
  return json({ ok:true, accepted, conflicts, skipped, latestSeq:Number(latest?.seq||0), authoritativeGeneration });
}

async function primaryReconcile(request, env) {
  const auth = await requirePrimaryDevice(request, env);
  if (!auth.ok) return json({ok:false,error:auth.error,code:auth.code||"AUTH"}, auth.code==="READ_ONLY"?403:409);
  await ensureSchema(env);
  let body; try { body=await request.json(); } catch { return json({ok:false,error:"JSON غير صالح"},400); }
  const records=Array.isArray(body.records)?body.records:[];
  if(!records.length) return json({ok:false,error:"لا توجد سجلات لاعتمادها"},400);
  if(records.length>2000) return json({ok:false,error:"عدد السجلات كبير"},413);

  // Read the current authoritative record IDs once. This endpoint is run once after deployment,
  // not on every 2.5-second sync cycle. Distributions (dist:*) are never touched.
  const current=await env.DB.prepare("SELECT record_id,data_json,version,deleted FROM sync_records WHERE record_id LIKE 'r-%'").all();
  const existing=new Map((current.results||[]).map(r=>[String(r.record_id),r]));
  const incoming=new Map();
  for(const item of records){
    const id=cleanString(item.recordId,200);
    if(!id || !id.startsWith("r-")) continue;
    incoming.set(id,item.data||{});
  }
  const statements=[]; const t=now(); let changed=0,deleted=0;
  for(const [id,data] of incoming){
    const old=existing.get(id);
    const dataJson=JSON.stringify(data);
    if(old && Number(old.deleted)===0 && old.data_json===dataJson) continue;
    const nextVersion=old?Number(old.version||0)+1:1;
    const opId=crypto.randomUUID();
    statements.push(
      env.DB.prepare(`INSERT INTO sync_records(record_id,data_json,updated_at,version,deleted,updated_by,created_at) VALUES(?,?,?,?,0,?,?) ON CONFLICT(record_id) DO UPDATE SET data_json=excluded.data_json,updated_at=excluded.updated_at,version=excluded.version,deleted=0,updated_by=excluded.updated_by`).bind(id,dataJson,t,nextVersion,auth.deviceId,t),
      env.DB.prepare(`INSERT INTO sync_changes(op_id,record_id,operation,data_json,updated_at,version,device_id,created_at) VALUES(?,?,?,?,?,?,?,?)`).bind(opId,id,"upsert",dataJson,t,nextVersion,auth.deviceId,t)
    );
    changed++;
    if(statements.length>=100){await env.DB.batch(statements.splice(0,100));}
  }
  for(const [id,old] of existing){
    if(incoming.has(id) || Number(old.deleted)===1) continue;
    const nextVersion=Number(old.version||0)+1; const opId=crypto.randomUUID();
    statements.push(
      env.DB.prepare(`UPDATE sync_records SET data_json='{}',updated_at=?,version=?,deleted=1,updated_by=? WHERE record_id=?`).bind(t,nextVersion,auth.deviceId,id),
      env.DB.prepare(`INSERT INTO sync_changes(op_id,record_id,operation,data_json,updated_at,version,device_id,created_at) VALUES(?,?,?,?,?,?,?,?)`).bind(opId,id,"delete",null,t,nextVersion,auth.deviceId,t)
    );
    deleted++;
    if(statements.length>=100){await env.DB.batch(statements.splice(0,100));}
  }
  if(statements.length) await env.DB.batch(statements);
  await setMeta(env,"authoritative_snapshot_at",t);
  await setMeta(env,"authoritative_record_count",incoming.size);
  // Advance the authoritative generation only when the primary data actually changed.
  // This prevents display devices from re-downloading the full snapshot and showing
  // a repeated "تم تحديث جهاز العرض تلقائياً" notification on every polling cycle.
  let authoritativeGeneration = Number(await getMeta(env,"authoritative_generation") || 0);
  if(changed || deleted){
    authoritativeGeneration += 1;
    await setMeta(env,"authoritative_generation",authoritativeGeneration);
  }
  const latest=await env.DB.prepare("SELECT seq FROM sync_changes ORDER BY seq DESC LIMIT 1").first();
  await setMeta(env,"latest_seq",Number(latest?.seq||0));
  return json({ok:true,authoritativeReady:true,recordCount:incoming.size,authoritativeGeneration,changed,deleted,latestSeq:Number(latest?.seq||0)});
}

async function authoritativeSnapshot(request, env) {
  const auth = await requireDisplayOrPrimary(request, env);
  if (!auth.ok) return json({ok:false,error:auth.error,code:auth.code},auth.code==="DISPLAY_DISABLED"?403:401);
  await ensureSchema(env);
  const generation = Number(await getMeta(env,"authoritative_generation") || 0);
  const ready = (await getMeta(env,"authoritative_snapshot_at")) !== "";
  if (!ready) return json({ok:false,error:"لم يتم اعتماد بيانات الجهاز الرئيسي بعد",code:"NOT_READY"},409);
  const url = new URL(request.url);
  const after = cleanString(url.searchParams.get("after"),200);
  const limit = Math.min(300, Math.max(1, Number(url.searchParams.get("limit") || 250)));
  const result = after
    ? await env.DB.prepare(`SELECT record_id,data_json,updated_at,version FROM sync_records WHERE deleted=0 AND record_id LIKE 'r-%' AND record_id > ? ORDER BY record_id ASC LIMIT ?`).bind(after,limit).all()
    : await env.DB.prepare(`SELECT record_id,data_json,updated_at,version FROM sync_records WHERE deleted=0 AND record_id LIKE 'r-%' ORDER BY record_id ASC LIMIT ?`).bind(limit).all();
  const rows = (result.results || []).map(r => ({
    recordId:String(r.record_id),
    data:r.data_json ? JSON.parse(r.data_json) : {},
    updatedAt:Number(r.updated_at),
    version:Number(r.version)
  }));
  const nextAfter = rows.length ? rows[rows.length-1].recordId : after;
  return json({ok:true,generation,records:rows,nextAfter,hasMore:rows.length===limit,recordCount:Number(await getMeta(env,"authoritative_record_count")||0)});
}

async function bootstrap(request, env) {
  const auth = await requirePrimaryDevice(request, env);
  if (!auth.ok) return json({ ok: false, error: auth.error, code: auth.code || "AUTH" }, auth.code === "READ_ONLY" ? 403 : 409);

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
      if (url.pathname === "/auth/display-login" && request.method === "POST") return await displayLogin(request, env);
      if (url.pathname === "/auth/display-validate" && request.method === "GET") return await displayValidate(request, env);
      if (url.pathname === "/auth/display-accounts" && request.method === "GET") return await listDisplayAccounts(request, env);
      if (url.pathname === "/auth/display-accounts" && request.method === "POST") return await createDisplayAccount(request, env);
      if (url.pathname === "/auth/display-account" && request.method === "POST") return await setDisplayAccount(request, env);
      if (url.pathname === "/sync/role" && request.method === "GET") return await role(request, env);
      if (url.pathname === "/sync/claim-primary" && request.method === "POST") return await claimPrimary(request, env);
      if (url.pathname === "/sync/pull" && request.method === "GET") return await pull(request, env);
      if (url.pathname === "/sync/push" && request.method === "POST") return await push(request, env);
      if (url.pathname === "/sync/primary-reconcile" && request.method === "POST") return await primaryReconcile(request, env);
      if (url.pathname === "/sync/authoritative" && request.method === "GET") return await authoritativeSnapshot(request, env);
      if (url.pathname === "/sync/bootstrap" && request.method === "POST") return await bootstrap(request, env);
      if (env.ASSETS) return await env.ASSETS.fetch(request);
      return json({ ok: false, error: "واجهة التطبيق غير مفعلة: اربط Static Assets" }, 404);
    } catch (e) {
      return json({ ok: false, error: "خطأ داخلي", detail: String(e?.message || e) }, 500);
    }
  }
};
