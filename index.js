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
      "access-control-allow-headers": "Content-Type, Authorization, X-Device-Id, X-Support-Session",
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
let displayAuthSchemaReady=false;
async function ensureAuthSchema(env){
  if(displayAuthSchemaReady)return;
  await ensureSchema(env);
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS display_accounts (id INTEGER PRIMARY KEY AUTOINCREMENT,full_name TEXT NOT NULL,username TEXT NOT NULL UNIQUE,password_salt TEXT NOT NULL,password_hash TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,last_login_at INTEGER,session_hash TEXT,session_expires_at INTEGER,last_seen_at INTEGER,failed_attempts INTEGER NOT NULL DEFAULT 0,locked_until INTEGER,permissions_json TEXT,emergency_locked INTEGER NOT NULL DEFAULT 0)`).run();
  let cols=await env.DB.prepare(`PRAGMA table_info(display_accounts)`).all();
  let names=new Set((cols.results||[]).map(x=>x.name));
  const migrations=[
    ["last_seen_at","ALTER TABLE display_accounts ADD COLUMN last_seen_at INTEGER"],
    ["failed_attempts","ALTER TABLE display_accounts ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0"],
    ["locked_until","ALTER TABLE display_accounts ADD COLUMN locked_until INTEGER"],
    ["permissions_json","ALTER TABLE display_accounts ADD COLUMN permissions_json TEXT"],
    ["emergency_locked","ALTER TABLE display_accounts ADD COLUMN emergency_locked INTEGER NOT NULL DEFAULT 0"]
  ];
  for(const [name,sql] of migrations){
    if(names.has(name))continue;
    try{await env.DB.prepare(sql).run()}catch(e){
      const check=await env.DB.prepare(`PRAGMA table_info(display_accounts)`).all();
      names=new Set((check.results||[]).map(x=>x.name));
      if(!names.has(name))throw new Error(`تعذر تجهيز قاعدة بيانات أجهزة العرض للحقل ${name}: ${e?.message||e}`);
    }
  }
  await env.DB.batch([
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_display_accounts_enabled ON display_accounts(enabled)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_display_accounts_session ON display_accounts(session_hash)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS display_activity (id INTEGER PRIMARY KEY AUTOINCREMENT,account_id INTEGER,username TEXT,action TEXT,details TEXT,device_id TEXT,created_at INTEGER NOT NULL)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_display_activity_account ON display_activity(account_id,created_at DESC)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_display_activity_created ON display_activity(created_at DESC)`)
  ]);
  displayAuthSchemaReady=true;
}
const DEFAULT_DISPLAY_PERMISSIONS={dashboard:true,families:true,people:true,search:true,reports:true,distributions:true,ids:false,phones:false,health:false,notes:false};
function normalizeDisplayPermissions(x){let p={...DEFAULT_DISPLAY_PERMISSIONS};if(x&&typeof x==='object'){for(const k of Object.keys(p))p[k]=x[k]===true}return p}
function parseDisplayPermissions(v){try{return normalizeDisplayPermissions(JSON.parse(v||'{}'))}catch{return {...DEFAULT_DISPLAY_PERMISSIONS}}}
async function logDisplayActivity(env,accountId,username,action,details='',deviceId=''){try{await env.DB.prepare(`INSERT INTO display_activity(account_id,username,action,details,device_id,created_at) VALUES(?,?,?,?,?,?)`).bind(accountId||null,cleanString(username,120),cleanString(action,120),cleanString(details,500),cleanString(deviceId,120),now()).run()}catch(e){}}
function redactDisplayData(data,permissions){const p=normalizeDisplayPermissions(permissions);if(!data||typeof data!=='object')return data;const o={...data};const keys=Object.keys(o);for(const k of keys){const n=String(k);if(!p.ids && /(^|\s)(رقم هوية|رقم الهوية|الهوية|id)(\s|$)/i.test(n))delete o[k];if(!p.phones && /جوال|هاتف|هاتف|phone|mobile/i.test(n))delete o[k];if(!p.health && /مرض|إصابة|إعاقة|حامل|مرضعة|يتيم|صحي|health|injur|disab/i.test(n))delete o[k];if(!p.notes && /ملاحظات|note/i.test(n))delete o[k]}return o}
async function displaySession(request,env){await ensureAuthSchema(env);const auth=request.headers.get("Authorization")||"";const token=auth.startsWith("Bearer ")?auth.slice(7):"";if(!token)return {ok:false,error:"تسجيل الدخول مطلوب",code:"DISPLAY_AUTH_REQUIRED"};const sh=await hashText(token);const row=await env.DB.prepare(`SELECT id,full_name,username,enabled,emergency_locked,permissions_json,session_expires_at,last_seen_at FROM display_accounts WHERE session_hash=? LIMIT 1`).bind(sh).first();if(!row)return {ok:false,error:"جلسة الدخول غير صالحة",code:"DISPLAY_AUTH_REQUIRED"};if(Number(row.enabled)!==1)return {ok:false,error:"تم إيقاف حساب جهاز العرض من الجهاز الرئيسي",code:"DISPLAY_DISABLED"};if(Number(row.emergency_locked)===1)return {ok:false,error:"تم قفل جهاز العرض مؤقتاً من الجهاز الرئيسي",code:"DISPLAY_EMERGENCY_LOCK"};if(Number(row.session_expires_at||0)<now())return {ok:false,error:"انتهت جلسة الدخول، سجّل الدخول من جديد",code:"DISPLAY_AUTH_REQUIRED"};if(!row.last_seen_at || now()-Number(row.last_seen_at)>30000)await env.DB.prepare(`UPDATE display_accounts SET last_seen_at=? WHERE id=?`).bind(now(),Number(row.id)).run();return {ok:true,accountId:Number(row.id),fullName:cleanString(row.full_name,200),username:cleanString(row.username,120),permissions:parseDisplayPermissions(row.permissions_json),expiresAt:Number(row.session_expires_at||0)}}
async function requireDisplayOrPrimary(request,env){const p=await requirePrimaryDevice(request,env);if(p.ok)return {...p,role:"primary"};const d=await displaySession(request,env);if(d.ok)return {...d,role:"display"};return {ok:false,error:d.error,code:d.code||p.code||"AUTH"}}
async function displayLogin(request,env){
  await ensureAuthSchema(env);
  let body;try{body=await request.json()}catch{return json({ok:false,error:"بيانات الدخول غير صالحة"},400)}
  const username=cleanString(body.username,120).toLowerCase(),password=String(body.password||"");
  if(!username||password.length<6)return json({ok:false,error:"اسم المستخدم وكلمة المرور مطلوبان"},400);
  const row=await env.DB.prepare(`SELECT id,full_name,username,password_salt,password_hash,enabled,failed_attempts,locked_until,permissions_json,emergency_locked FROM display_accounts WHERE username=? LIMIT 1`).bind(username).first();
  if(!row)return json({ok:false,error:"اسم المستخدم أو كلمة المرور غير صحيحة",code:"BAD_LOGIN"},401);
  const locked=Number(row.locked_until||0)>now();
  if(locked){const sec=Math.max(1,Math.ceil((Number(row.locked_until)-now())/1000));return json({ok:false,error:`تم إيقاف محاولات الدخول مؤقتًا — حاول بعد ${sec} ثانية`,code:"LOGIN_LOCKED",retryAfter:sec},429)}
  if(Number(row.enabled)!==1)return json({ok:false,error:"تم إيقاف حساب جهاز العرض من الجهاز الرئيسي",code:"DISPLAY_DISABLED"},403);
  if(Number(row.emergency_locked)===1)return json({ok:false,error:"تم قفل جهاز العرض مؤقتاً من الجهاز الرئيسي",code:"DISPLAY_EMERGENCY_LOCK"},403);
  const check=await hashText(String(row.password_salt)+password);
  if(check!==String(row.password_hash)){
    const attempts=Number(row.failed_attempts||0)+1;
    const lockUntil=attempts>=5?now()+60000:null;
    await env.DB.prepare(`UPDATE display_accounts SET failed_attempts=?,locked_until=?,updated_at=? WHERE id=?`).bind(lockUntil?0:attempts,lockUntil,now(),Number(row.id)).run();
    if(lockUntil)return json({ok:false,error:"تم إيقاف محاولات الدخول مؤقتًا — حاول بعد 60 ثانية",code:"LOGIN_LOCKED",retryAfter:60},429);
    return json({ok:false,error:"اسم المستخدم أو كلمة المرور غير صحيحة",code:"BAD_LOGIN",attemptsRemaining:Math.max(0,5-attempts)},401);
  }
  const token=randomToken(),sessionHash=await hashText(token),expires=now()+1000*60*60*24*30;
  await env.DB.prepare(`UPDATE display_accounts SET session_hash=?,session_expires_at=?,last_login_at=?,last_seen_at=?,failed_attempts=0,locked_until=NULL,updated_at=? WHERE id=?`).bind(sessionHash,expires,now(),now(),now(),Number(row.id)).run();
  await logDisplayActivity(env,Number(row.id),cleanString(row.username,120),"تسجيل دخول","تم تسجيل الدخول بنجاح",request.headers.get("X-Device-Id")||"");
  return json({ok:true,token,expiresAt:expires,displayName:cleanString(row.full_name,200),username:cleanString(row.username,120),permissions:parseDisplayPermissions(row.permissions_json)});
}
async function displayValidate(request,env){const d=await displaySession(request,env);if(!d.ok)return json({ok:false,error:d.error,code:d.code},d.code==="DISPLAY_DISABLED"?403:401);return json({ok:true,displayName:d.fullName,username:d.username,permissions:d.permissions,expiresAt:d.expiresAt})}
async function listDisplayAccounts(request,env){const auth=await requirePrimaryDevice(request,env);if(!auth.ok)return json({ok:false,error:auth.error,code:auth.code||"AUTH"},auth.code==="READ_ONLY"?403:401);await ensureAuthSchema(env);const rows=await env.DB.prepare(`SELECT id,full_name,username,enabled,emergency_locked,permissions_json,created_at,updated_at,last_login_at,last_seen_at,session_expires_at FROM display_accounts ORDER BY id DESC`).all();return json({ok:true,accounts:(rows.results||[]).map(r=>({id:Number(r.id),fullName:r.full_name,username:r.username,enabled:Number(r.enabled)===1,emergencyLocked:Number(r.emergency_locked)===1,permissions:parseDisplayPermissions(r.permissions_json),sessionExpiresAt:r.session_expires_at?Number(r.session_expires_at):null,createdAt:Number(r.created_at),updatedAt:Number(r.updated_at),lastLoginAt:r.last_login_at?Number(r.last_login_at):null,lastSeenAt:r.last_seen_at?Number(r.last_seen_at):null}))})}
async function createDisplayAccount(request,env){const requestId=cleanString(request.headers.get("X-Request-Id")||crypto.randomUUID(),80);try{const auth=await requirePrimaryDevice(request,env);if(!auth.ok)return json({ok:false,error:auth.error,code:auth.code||"AUTH",requestId},auth.code==="READ_ONLY"?403:401);await ensureAuthSchema(env);let body;try{body=await request.json()}catch{return json({ok:false,error:"JSON غير صالح",requestId},400)}const fullName=cleanString(body.fullName,200),username=cleanString(body.username,120).toLowerCase(),password=String(body.password||"");if(fullName.length<3||username.length<3||password.length<6)return json({ok:false,error:"أدخل الاسم الرباعي واسم مستخدم من 3 أحرف على الأقل وكلمة مرور من 6 أحرف على الأقل",requestId},400);if(!/^[a-zA-Z0-9._-]+$/.test(username))return json({ok:false,error:"اسم المستخدم يجب أن يحتوي على أحرف إنجليزية وأرقام و . _ - فقط",requestId},400);const exists=await env.DB.prepare(`SELECT id,full_name,username FROM display_accounts WHERE username=? LIMIT 1`).bind(username).first();if(exists)return json({ok:false,error:"اسم المستخدم مستخدم بالفعل",code:"USERNAME_EXISTS",requestId,accountId:Number(exists.id)},409);const salt=randomToken(),ph=await hashText(salt+password),t=now();const res=await env.DB.prepare(`INSERT INTO display_accounts(full_name,username,password_salt,password_hash,enabled,created_at,updated_at) VALUES(?,?,?,?,1,?,?)`).bind(fullName,username,salt,ph,t,t).run();const id=Number(res.meta?.last_row_id||0);if(!id)throw new Error("تم تنفيذ الحفظ دون إرجاع رقم الحساب");try{await env.DB.prepare(`UPDATE display_accounts SET permissions_json=?,emergency_locked=0 WHERE id=?`).bind(JSON.stringify(DEFAULT_DISPLAY_PERMISSIONS),id).run()}catch(e){throw new Error(`تم إنشاء الحساب لكن تعذر حفظ إعداداته الإضافية: ${e?.message||e}`)}await logDisplayActivity(env,id,username,"إنشاء حساب جهاز عرض","تم إنشاء الحساب من الجهاز الرئيسي",request.headers.get("X-Device-Id")||"");return json({ok:true,id,fullName,username,requestId})}catch(e){return json({ok:false,error:`تعذر إنشاء حساب جهاز العرض: ${e?.message||e}`,code:"DISPLAY_ACCOUNT_CREATE_FAILED",requestId},500)}}
async function revokeDisplaySession(request,env){await ensureAuthSchema(env);const auth=await requirePrimaryDevice(request,env);if(!auth.ok)return json({ok:false,error:auth.error,code:auth.code||"AUTH"},auth.code==="READ_ONLY"?403:401);let body;try{body=await request.json()}catch{return json({ok:false,error:"JSON غير صالح"},400)}const id=Number(body.id||0);if(!id)return json({ok:false,error:"معرّف الحساب مفقود"},400);const r=await env.DB.prepare(`UPDATE display_accounts SET session_hash=NULL,session_expires_at=NULL,updated_at=? WHERE id=?`).bind(now(),id).run();if(!r.meta?.changes)return json({ok:false,error:"حساب جهاز العرض غير موجود"},404);await logDisplayActivity(env,id,"","إنهاء جلسة عن بُعد","",request.headers.get("X-Device-Id")||"");return json({ok:true})}
async function setDisplayAccount(request,env){const auth=await requirePrimaryDevice(request,env);if(!auth.ok)return json({ok:false,error:auth.error,code:auth.code||"AUTH"},auth.code==="READ_ONLY"?403:401);await ensureAuthSchema(env);let body;try{body=await request.json()}catch{return json({ok:false,error:"JSON غير صالح"},400)}const id=Number(body.id||0);if(!id)return json({ok:false,error:"معرّف الحساب مفقود"},400);const exists=await env.DB.prepare(`SELECT id FROM display_accounts WHERE id=?`).bind(id).first();if(!exists)return json({ok:false,error:"حساب جهاز العرض غير موجود"},404);const enabled=body.enabled===true,password=String(body.password||"");if(password){if(password.length<6)return json({ok:false,error:"كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل"},400);const salt=randomToken(),ph=await hashText(salt+password);await env.DB.prepare(`UPDATE display_accounts SET enabled=?,password_salt=?,password_hash=?,session_hash=NULL,session_expires_at=NULL,updated_at=? WHERE id=?`).bind(enabled?1:0,salt,ph,now(),id).run()}else{if(enabled)await env.DB.prepare(`UPDATE display_accounts SET enabled=1,updated_at=? WHERE id=?`).bind(now(),id).run();else await env.DB.prepare(`UPDATE display_accounts SET enabled=0,session_hash=NULL,session_expires_at=NULL,updated_at=? WHERE id=?`).bind(now(),id).run()}await logDisplayActivity(env,id,"","تحديث الحساب",password?"تغيير كلمة المرور":"تغيير حالة الحساب",request.headers.get("X-Device-Id")||"");return json({ok:true})}

async function setDisplayPermissions(request,env){const auth=await requirePrimaryDevice(request,env);if(!auth.ok)return json({ok:false,error:auth.error,code:auth.code||"AUTH"},auth.code==="READ_ONLY"?403:401);await ensureAuthSchema(env);let body;try{body=await request.json()}catch{return json({ok:false,error:"JSON غير صالح"},400)}const id=Number(body.id||0);const row=await env.DB.prepare(`SELECT id,username FROM display_accounts WHERE id=?`).bind(id).first();if(!row)return json({ok:false,error:"حساب جهاز العرض غير موجود"},404);const perms=normalizeDisplayPermissions(body.permissions);await env.DB.prepare(`UPDATE display_accounts SET permissions_json=?,updated_at=? WHERE id=?`).bind(JSON.stringify(perms),now(),id).run();await logDisplayActivity(env,id,row.username,"تغيير الصلاحيات",JSON.stringify(perms),request.headers.get("X-Device-Id")||"");return json({ok:true,permissions:perms})}
async function setDisplayEmergencyLock(request,env){const auth=await requirePrimaryDevice(request,env);if(!auth.ok)return json({ok:false,error:auth.error,code:auth.code||"AUTH"},auth.code==="READ_ONLY"?403:401);await ensureAuthSchema(env);let body;try{body=await request.json()}catch{return json({ok:false,error:"JSON غير صالح"},400)}const id=Number(body.id||0),locked=body.locked===true;const row=await env.DB.prepare(`SELECT id,username FROM display_accounts WHERE id=?`).bind(id).first();if(!row)return json({ok:false,error:"حساب جهاز العرض غير موجود"},404);await env.DB.prepare(`UPDATE display_accounts SET emergency_locked=?,session_hash=CASE WHEN ?=1 THEN NULL ELSE session_hash END,session_expires_at=CASE WHEN ?=1 THEN NULL ELSE session_expires_at END,updated_at=? WHERE id=?`).bind(locked?1:0,locked?1:0,locked?1:0,now(),id).run();await logDisplayActivity(env,id,row.username,locked?"قفل طوارئ":"إلغاء قفل الطوارئ",locked?"تم إيقاف الوصول فوراً":"تم السماح بالدخول",request.headers.get("X-Device-Id")||"");return json({ok:true,locked})}
async function listDisplayActivity(request,env){const auth=await requirePrimaryDevice(request,env);if(!auth.ok)return json({ok:false,error:auth.error,code:auth.code||"AUTH"},auth.code==="READ_ONLY"?403:401);await ensureAuthSchema(env);const url=new URL(request.url),id=Number(url.searchParams.get("accountId")||0),limit=Math.min(100,Math.max(1,Number(url.searchParams.get("limit")||30)));const q=id?env.DB.prepare(`SELECT id,account_id,username,action,details,device_id,created_at FROM display_activity WHERE account_id=? ORDER BY id DESC LIMIT ?`).bind(id,limit):env.DB.prepare(`SELECT id,account_id,username,action,details,device_id,created_at FROM display_activity ORDER BY id DESC LIMIT ?`).bind(limit);const r=await q.all();return json({ok:true,items:(r.results||[]).map(x=>({id:Number(x.id),accountId:x.account_id?Number(x.account_id):null,username:x.username,action:x.action,details:x.details,deviceId:x.device_id,createdAt:Number(x.created_at)}))})}
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
  return json({ok:true,deviceId:auth.deviceId,primaryDeviceId:primary||null,isPrimary,configured:!!primary,authoritativeReady:ready,authoritativeRecordCount:count,authoritativeGeneration:generation,displayAuthenticated:!!display.ok,displayAuthRequired:false,displayName:display.ok?display.fullName:"",displayUsername:display.ok?display.username:"",displayPermissions:display.ok?display.permissions:null,displaySessionExpiresAt:display.ok?display.expiresAt:null});
}

async function syncPulse(request, env) {
  const auth = requireAuth(request, env);
  if (!auth.ok) return json({ok:false,error:auth.error,code:"AUTH"},401);
  const primary = await getPrimaryDevice(env);
  const isPrimary = !!primary && auth.deviceId === primary;
  let display = null;
  if (!isPrimary) {
    display = await displaySession(request, env);
    if (!display.ok) return json({ok:false,error:display.error,code:display.code||"DISPLAY_AUTH_REQUIRED",displayAuthRequired:true}, display.code === "DISPLAY_DISABLED" || display.code === "DISPLAY_EMERGENCY_LOCK" ? 403 : 401);
  }
  const ready = (await getMeta(env,"authoritative_snapshot_at")) !== "";
  const generation = Number(await getMeta(env,"authoritative_generation") || 0);
  const count = Number(await getMeta(env,"authoritative_record_count") || 0);
  return json({ok:true,isPrimary,authoritativeReady:ready,authoritativeGeneration:generation,authoritativeRecordCount:count,displayAuthenticated:!!display?.ok,displayPermissions:display?.permissions||null,displaySessionExpiresAt:display?.expiresAt||null,serverTime:now()});
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
  if(scope === "distributions" && auth.role === "display" && auth.permissions?.distributions === false){
    return json({ok:false,error:"هذه الوظيفة غير متاحة لهذا الحساب",code:"DISPLAY_PERMISSION_DENIED"},403);
  }
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
    data: r.data_json ? (auth.role === "display" ? redactDisplayData(JSON.parse(r.data_json), auth.permissions) : JSON.parse(r.data_json)) : null,
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

  // V67: server-side guard for the active campaign rule (one aid type per family).
  // This is additive: it uses existing dist:* records and does not change the D1 schema.
  const hasDistributionChanges = incoming.some(x => String(x?.recordId || '').startsWith('dist:'));
  const campaignNorm = value => String(value ?? '').normalize('NFKC').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[ًٌٍَُِّْـٰ]/g, '')
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[إأآٱ]/g, 'ا').replace(/[ى]/g, 'ي').replace(/[ة]/g, 'ه')
    .replace(/[ـ\u200e\u200f\u202a-\u202e]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const campaignIdNorm = value => String(value ?? '').normalize('NFKC')
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
  const campaignFamily = record => ({
    id: campaignIdNorm(record?.familyId),
    name: campaignNorm(record?.familyName || (record?.beneficiaryType === 'عائلة' ? record?.beneficiaryName : ''))
  });
  const campaignSameFamily = (a, b) => {
    const x = campaignFamily(a), y = campaignFamily(b);
    if (x.id && y.id) return x.id === y.id;
    return !!x.name && !!y.name && x.name === y.name;
  };
  const campaignCancelled = record => {
    const status = campaignNorm(record?.workflowStatus || record?.statusLabel || '');
    return ['ملغي', 'ملغاه', 'الغاء', 'cancelled', 'canceled'].includes(status);
  };
  const campaignActive = new Map();
  if (hasDistributionChanges) {
    const stored = await env.DB.prepare(
      "SELECT record_id, data_json FROM sync_records WHERE record_id LIKE 'dist:%' AND deleted = 0"
    ).all();
    for (const row of (stored.results || [])) {
      try {
        const value = row.data_json ? JSON.parse(row.data_json) : null;
        if (value && !campaignCancelled(value)) campaignActive.set(String(row.record_id), value);
      } catch { /* Ignore malformed legacy records; they remain untouched. */ }
    }
  }

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

    // Check only campaign distribution records; family data and all other sync scopes
    // keep their existing behavior. Exclude this record while editing it.
    if (recordId.startsWith('dist:') && operation !== 'delete' && !campaignCancelled(data)) {
      const candidateType = campaignNorm(data?.type);
      const candidateFamily = campaignFamily(data);
      if (candidateType && (candidateFamily.id || candidateFamily.name)) {
        let duplicate = null;
        for (const [otherId, other] of campaignActive) {
          if (otherId === recordId || campaignCancelled(other)) continue;
          if (campaignNorm(other?.type) === candidateType && campaignSameFamily(data, other)) {
            duplicate = { id: otherId, reference: String(other?.reference || '') };
            break;
          }
        }
        if (duplicate) {
          conflicts.push({
            opId, recordId,
            reason: 'مرفوض: نوع المساعدة مسجل مسبقاً لهذه العائلة',
            duplicateRecordId: duplicate.id,
            duplicateReference: duplicate.reference
          });
          continue;
        }
      }
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
    if (recordId.startsWith('dist:')) {
      if (operation === 'delete' || campaignCancelled(data)) campaignActive.delete(recordId);
      else campaignActive.set(recordId, data);
    }
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
    data:r.data_json ? (auth.role === "display" ? redactDisplayData(JSON.parse(r.data_json), auth.permissions) : JSON.parse(r.data_json)) : {},
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


/* Abu Oreiban Support Portal API — additive endpoints; existing sync routes/schema remain unchanged. */
async function ensureSupportSchema(env) {
  await ensureSchema(env);
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS support_requests (
      id TEXT PRIMARY KEY, ticket_no TEXT NOT NULL UNIQUE, request_type TEXT NOT NULL,
      family_name TEXT NOT NULL, family_id TEXT NOT NULL, phone TEXT NOT NULL,
      subject TEXT NOT NULL, message TEXT NOT NULL, requested_changes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'جديد', staff_reply TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, device_hint TEXT NOT NULL DEFAULT ''
    )`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_support_requests_created ON support_requests(created_at DESC)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_support_requests_status ON support_requests(status,created_at DESC)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS support_challenges (
      challenge_id TEXT PRIMARY KEY, family_id TEXT NOT NULL, challenge_json TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS support_sessions (
      token TEXT PRIMARY KEY, family_id TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_support_challenges_expiry ON support_challenges(expires_at)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_support_sessions_expiry ON support_sessions(expires_at)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS support_failures (
      family_id TEXT PRIMARY KEY, failed_count INTEGER NOT NULL DEFAULT 0,
      window_start INTEGER NOT NULL, blocked_until INTEGER NOT NULL DEFAULT 0
    )`)
  ]);
}
function supportNorm(v) {
  return String(v ?? '').normalize('NFKC')
    .replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي')
    .replace(/[^\p{L}\p{N}]/gu,'').toLowerCase();
}
function supportPhone(v) { return String(v ?? '').replace(/[^\d٠-٩۰-۹]/g,'').replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))); }
function supportPublicRecord(r) {
  const allow = ["اسم رب الأسرة","رقم هوية الأسرة","رقم الجوال","رقم جوال بديل","العنوان","داخل/خارج المخيم","حالة اكتمال بيانات الأسرة","المحافظة الأصلية","حالة المسكن الأصلي","نوع السكن الحالي","اسم الفرد","صلة القرابة","الجنس","الحالة الاجتماعية","تاريخ الميلاد","العمر التقريبي","رقم هوية الفرد","مرض مزمن؟","نوع المرض","إصابة؟","إصابة?","سبب الإصابة","تفاصيل الإصابة","إعاقة؟","نوع الإعاقة","يتيم/منفصل عن ذويه؟","حامل؟","مرضعة؟","ملاحظات الفرد","ملاحظات الأسرة"];
  const out={};
  for(const k of allow) if(r && r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== "") out[k]=r[k];
  return out;
}
function supportYear(v) {
  const s=String(v ?? '').trim();
  const matches=s.match(/(?:19|20)\d{2}/g);
  if(matches && matches.length) return matches[matches.length-1];
  const digits=s.replace(/[^0-9٠-٩۰-۹]/g,'').replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  if(digits.length===4 && Number(digits)>=1900 && Number(digits)<=2035) return digits;
  return '';
}
async function supportRowsForFamily(env, familyId) {
  const result=await env.DB.prepare(`SELECT record_id,data_json FROM sync_records WHERE deleted=0 AND record_id LIKE 'r-%' ORDER BY record_id ASC LIMIT 5000`).all();
  const rows=[];
  for(const item of (result.results||[])) {
    try { const r=JSON.parse(item.data_json||'{}'); if(supportNorm(r['رقم هوية الأسرة'])===supportNorm(familyId)) rows.push(r); } catch {}
  }
  return rows;
}
function supportChallengeCandidates(rows) {
  const candidates=[];
  const wife=rows.find(r=>{const rel=supportNorm(r['صلة القرابة']);return rel.includes(supportNorm('زوجة')) || rel===supportNorm('الزوجة');});
  if(wife) { const y=supportYear(wife['تاريخ الميلاد']||wife['سنة الميلاد']); if(y) candidates.push({key:'a'+candidates.length,label:'ما سنة ميلاد الزوجة المسجّلة؟',answer:y,kind:'year'}); }
  const children=rows.filter(r=>{const rel=supportNorm(r['صلة القرابة']);return rel.includes(supportNorm('ابن'))||rel.includes(supportNorm('بنت'))||rel.includes(supportNorm('طفل'))||rel.includes(supportNorm('طفلة'));});
  for(const child of children) { const y=supportYear(child['تاريخ الميلاد']||child['سنة الميلاد']); if(y) { const childName=String(child['اسم الفرد']||'').trim(); candidates.push({key:'a'+candidates.length,label:childName ? `ما سنة ميلاد ${childName} المسجّل/ة في الكشف؟` : 'ما سنة ميلاد أحد الأبناء المسجّلين؟',answer:y,kind:'year'}); } }
  const first=rows.find(r=>supportPhone(r['رقم الجوال']).length>=8);
  if(first) { const p=supportPhone(first['رقم الجوال']); candidates.push({key:'a'+candidates.length,label:'ما آخر أربعة أرقام من رقم الجوال المعتمد؟',answer:p.slice(-4),kind:'last4'}); }
  // Prefer two different kinds of evidence; don't repeat the same generic child question twice.
  const picked=[];
  const wifeCandidate=candidates.find(c=>c.label.includes('الزوجة'));
  const childCandidate=candidates.find(c=>c.label.includes('الأبناء'));
  const phoneCandidate=candidates.find(c=>c.kind==='last4');
  if(wifeCandidate) picked.push(wifeCandidate);
  if(childCandidate && picked.length<2) picked.push(childCandidate);
  if(picked.length<2 && phoneCandidate && !picked.includes(phoneCandidate)) picked.push(phoneCandidate);
  if(picked.length<2) for(const c of candidates) if(!picked.includes(c) && picked.length<2) picked.push(c);
  return picked.map((c,i)=>({...c,key:'a'+i}));
}
async function supportChallenge(request, env) {
  await ensureSupportSchema(env);
  let body; try { body=await request.json(); } catch { return json({ok:false,error:'البيانات المرسلة غير صالحة'},400); }
  const familyId=supportNorm(body.familyId);
  if(familyId.length<5) return json({ok:false,error:'أدخل رقم هوية رب الأسرة بشكل صحيح'},400);
  const t0=now();
  const failure=await env.DB.prepare('SELECT failed_count,window_start,blocked_until FROM support_failures WHERE family_id=? LIMIT 1').bind(familyId).first();
  if(failure && Number(failure.blocked_until)>t0) return json({ok:false,error:'تم إيقاف التحقق مؤقتًا بسبب محاولات غير صحيحة. حاول لاحقًا أو تواصل مع مندوب المنطقة.'},429);
  const rows=await supportRowsForFamily(env,familyId);
  if(!rows.length) return json({ok:false,error:'تعذّر بدء التحقق بهذه البيانات. تأكد من رقم الهوية أو تواصل مع مندوب المنطقة.'},404);
  const questions=supportChallengeCandidates(rows);
  if(questions.length<2) return json({ok:false,error:'لا تتوفر بيانات تحقق كافية لهذه الأسرة في السجل. يرجى مراجعة مندوب المنطقة لتحديث البيانات.'},409);
  const challengeId=crypto.randomUUID(), t=now();
  await env.DB.prepare('INSERT INTO support_challenges(challenge_id,family_id,challenge_json,attempts,expires_at,created_at) VALUES(?,?,?,0,?,?)').bind(challengeId,familyId,JSON.stringify(questions),t+5*60*1000,t).run();
  return json({ok:true,challengeId,questions:questions.map(q=>({key:q.key,label:q.label})),expiresInSeconds:300});
}
async function supportVerify(request, env) {
  await ensureSupportSchema(env);
  let body; try { body=await request.json(); } catch { return json({ok:false,error:'البيانات المرسلة غير صالحة'},400); }
  const challengeId=cleanString(body.challengeId,80);
  const row=await env.DB.prepare('SELECT challenge_id,family_id,challenge_json,attempts,expires_at FROM support_challenges WHERE challenge_id=? LIMIT 1').bind(challengeId).first();
  if(!row || Number(row.expires_at)<now()) return json({ok:false,error:'انتهت صلاحية أسئلة التحقق. ابدأ من جديد.'},410);
  if(Number(row.attempts)>=3) return json({ok:false,error:'تم إيقاف المحاولة بعد إجابات غير صحيحة. ابدأ تحققًا جديدًا أو تواصل مع مندوب المنطقة.'},429);
  let qs=[]; try { qs=JSON.parse(row.challenge_json||'[]'); } catch {}
  const answers=body.answers||{};
  const ok=qs.length>=2 && qs.every(q=>{
    const given=String(answers[q.key]??'');
    return q.kind==='last4' ? supportPhone(given).slice(-4)===q.answer : supportYear(given)===q.answer;
  });
  if(!ok) {
    const attempts=Number(row.attempts)+1, t=now();
    await env.DB.prepare('UPDATE support_challenges SET attempts=? WHERE challenge_id=?').bind(attempts,challengeId).run();
    const prior=await env.DB.prepare('SELECT failed_count,window_start FROM support_failures WHERE family_id=? LIMIT 1').bind(row.family_id).first();
    const count=prior && t-Number(prior.window_start)<15*60*1000 ? Number(prior.failed_count)+1 : 1;
    const windowStart=prior && t-Number(prior.window_start)<15*60*1000 ? Number(prior.window_start) : t;
    const blockedUntil=count>=5 ? t+15*60*1000 : 0;
    await env.DB.prepare('INSERT INTO support_failures(family_id,failed_count,window_start,blocked_until) VALUES(?,?,?,?) ON CONFLICT(family_id) DO UPDATE SET failed_count=excluded.failed_count,window_start=excluded.window_start,blocked_until=excluded.blocked_until').bind(row.family_id,count,windowStart,blockedUntil).run();
    const error=blockedUntil ? 'تكررت الإجابات غير الصحيحة. تم إيقاف التحقق مؤقتًا لمدة 15 دقيقة.' : attempts>=3 ? 'الإجابات غير صحيحة. انتهت هذه المحاولة؛ ابدأ تحققًا جديدًا أو تواصل مع مندوب المنطقة.' : 'الإجابات غير صحيحة. راجع البيانات وحاول مجددًا.';
    return json({ok:false,error},403);
  }
  await env.DB.prepare('DELETE FROM support_failures WHERE family_id=?').bind(row.family_id).run();
  const token=crypto.randomUUID()+crypto.randomUUID().replace(/-/g,''), t=now();
  await env.DB.prepare('INSERT INTO support_sessions(token,family_id,expires_at,created_at) VALUES(?,?,?,?)').bind(token,row.family_id,t+30*60*1000,t).run();
  await env.DB.prepare('DELETE FROM support_challenges WHERE challenge_id=?').bind(challengeId).run();
  return json({ok:true,sessionToken:token,expiresInSeconds:1800,message:'تم التحقق بنجاح.'});
}
async function supportSession(env, token) {
  if(!token) return null;
  const row=await env.DB.prepare('SELECT family_id,expires_at FROM support_sessions WHERE token=? LIMIT 1').bind(token).first();
  if(!row || Number(row.expires_at)<now()) { if(row) await env.DB.prepare('DELETE FROM support_sessions WHERE token=?').bind(token).run(); return null; }
  return row;
}
async function supportLookup(request, env) {
  await ensureSupportSchema(env);
  const token=cleanString(request.headers.get('X-Support-Session')||'',200);
  const session=await supportSession(env,token);
  if(!session) return json({ok:false,error:'انتهت جلسة التحقق أو لم يتم التحقق من الهوية. أعد التحقق من بيانات الأسرة.'},401);
  const rows=await supportRowsForFamily(env,session.family_id);
  if(!rows.length) return json({ok:false,error:'تعذر العثور على بيانات الأسرة في السجل.'},404);
  const first=rows.find(r=>supportNorm(r['صلة القرابة'])===supportNorm('رب الأسرة'))||rows[0];
  const familyName=String(first['اسم رب الأسرة']||rows[0]['اسم رب الأسرة']||'');
  return json({ok:true,family:{name:familyName,fields:supportPublicRecord(first),members:rows.map(supportPublicRecord),count:rows.length}});
}
async function supportSubmit(request, env) {
  await ensureSupportSchema(env);
  let b; try { b=await request.json(); } catch { return json({ok:false,error:'البيانات المرسلة غير صالحة'},400); }
  const token=cleanString(request.headers.get('X-Support-Session')||b.sessionToken||'',200);
  const session=await supportSession(env,token);
  if(!session) return json({ok:false,error:'انتهت جلسة التحقق. أعد التحقق من بيانات الأسرة قبل إرسال الطلب.'},401);
  const rows=await supportRowsForFamily(env,session.family_id);
  if(!rows.length) return json({ok:false,error:'تعذر العثور على بيانات الأسرة في السجل.'},404);
  const first=rows.find(r=>supportNorm(r['صلة القرابة'])===supportNorm('رب الأسرة'))||rows[0];
  const type=cleanString(b.requestType,40), familyName=cleanString(first['اسم رب الأسرة']||rows[0]['اسم رب الأسرة']||'',200), familyId=String(session.family_id), phone=supportPhone(first['رقم الجوال']);
  const subject=cleanString(b.subject,160), message=cleanString(b.message,2500), changes=cleanString(b.requestedChanges,2000);
  if(!['استفسار','شكوى','طلب تحديث بيانات'].includes(type)) return json({ok:false,error:'نوع الطلب غير صحيح'},400);
  if(familyName.length<3 || phone.length<8 || subject.length<3 || message.length<5) return json({ok:false,error:'يرجى استكمال عنوان الطلب وتفاصيله'},400);
  const id=crypto.randomUUID(), ticketNo='ABO-'+new Date().toISOString().slice(0,10).replace(/-/g,'')+'-'+crypto.randomUUID().slice(0,6).toUpperCase(), t=now();
  await env.DB.prepare(`INSERT INTO support_requests(id,ticket_no,request_type,family_name,family_id,phone,subject,message,requested_changes,status,staff_reply,created_at,updated_at,device_hint) VALUES(?,?,?,?,?,?,?,?,?,'جديد','',?,?,?)`)
    .bind(id,ticketNo,type,familyName,familyId,phone,subject,message,changes,t,t,cleanString(request.headers.get('X-Device-Id'),120)).run();
  return json({ok:true,ticketNo,message:'تم استلام طلبك وحفظه لدى إدارة المخيم. احتفظ برقم المتابعة.'},201);
}
async function supportStatus(request, env) {
  await ensureSupportSchema(env);
  let b; try { b=await request.json(); } catch { return json({ok:false,error:"البيانات المرسلة غير صالحة"},400); }
  const ticket=cleanString(b.ticketNo,80), phone=supportPhone(b.phone);
  if(!ticket || phone.length<8) return json({ok:false,error:"أدخل رقم الطلب ورقم الجوال المسجل"},400);
  const row=await env.DB.prepare(`SELECT ticket_no,request_type,subject,status,staff_reply,created_at,updated_at FROM support_requests WHERE ticket_no=? AND phone=? LIMIT 1`).bind(ticket,phone).first();
  if(!row) return json({ok:false,error:"لم يتم العثور على الطلب بهذه البيانات"},404);
  return json({ok:true,request:{ticketNo:row.ticket_no,requestType:row.request_type,subject:row.subject,status:row.status,staffReply:row.staff_reply,createdAt:Number(row.created_at),updatedAt:Number(row.updated_at)}});
}
async function supportList(request, env) {
  const auth=await requirePrimaryDevice(request,env);
  if(!auth.ok) return json({ok:false,error:auth.error,code:auth.code||"AUTH"},auth.code==="READ_ONLY"?403:401);
  await ensureSupportSchema(env);
  const url=new URL(request.url), status=cleanString(url.searchParams.get("status"),40), q=cleanString(url.searchParams.get("q"),120);
  let sql=`SELECT id,ticket_no,request_type,family_name,family_id,phone,subject,message,requested_changes,status,staff_reply,created_at,updated_at FROM support_requests`;
  const where=[], vals=[];
  if(status){where.push("status=?");vals.push(status)}
  if(q){where.push("(family_name LIKE ? OR ticket_no LIKE ? OR family_id LIKE ? OR subject LIKE ?)");vals.push("%"+q+"%","%"+q+"%","%"+q+"%","%"+q+"%")}
  if(where.length)sql+=" WHERE "+where.join(" AND ");
  sql+=" ORDER BY created_at DESC LIMIT 300";
  const stmt=env.DB.prepare(sql);
  const res=await (vals.length?stmt.bind(...vals):stmt).all();
  return json({ok:true,items:(res.results||[]).map(r=>({id:r.id,ticketNo:r.ticket_no,requestType:r.request_type,familyName:r.family_name,familyId:r.family_id,phone:r.phone,subject:r.subject,message:r.message,requestedChanges:r.requested_changes,status:r.status,staffReply:r.staff_reply,createdAt:Number(r.created_at),updatedAt:Number(r.updated_at)}))});
}
async function supportUpdate(request, env) {
  const auth=await requirePrimaryDevice(request,env);
  if(!auth.ok) return json({ok:false,error:auth.error,code:auth.code||"AUTH"},auth.code==="READ_ONLY"?403:401);
  await ensureSupportSchema(env);
  let b; try { b=await request.json(); } catch { return json({ok:false,error:"البيانات المرسلة غير صالحة"},400); }
  const ticket=cleanString(b.ticketNo,80), status=cleanString(b.status,40), reply=cleanString(b.staffReply,2000);
  if(!ticket || !["جديد","قيد المراجعة","تم الرد","تم الحل","مرفوض"].includes(status)) return json({ok:false,error:"حالة الطلب غير صحيحة"},400);
  const r=await env.DB.prepare(`UPDATE support_requests SET status=?,staff_reply=?,updated_at=? WHERE ticket_no=?`).bind(status,reply,now(),ticket).run();
  if(!r.meta?.changes) return json({ok:false,error:"الطلب غير موجود"},404);
  return json({ok:true});
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": ALLOWED_ORIGIN,
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "Content-Type, Authorization, X-Device-Id, X-Support-Session"
        }
      });
    }

    const url = new URL(request.url);
    try {
      if (url.pathname === "/support/challenge" && request.method === "POST") return await supportChallenge(request, env);
      if (url.pathname === "/support/verify" && request.method === "POST") return await supportVerify(request, env);
      if (url.pathname === "/support/lookup" && request.method === "POST") return await supportLookup(request, env);
      if (url.pathname === "/support/submit" && request.method === "POST") return await supportSubmit(request, env);
      if (url.pathname === "/support/status" && request.method === "POST") return await supportStatus(request, env);
      if (url.pathname === "/support/list" && request.method === "GET") return await supportList(request, env);
      if (url.pathname === "/support/update" && request.method === "POST") return await supportUpdate(request, env);
      if (url.pathname === "/health") return await health(env);
      if (url.pathname === "/auth/display-login" && request.method === "POST") return await displayLogin(request, env);
      if (url.pathname === "/auth/display-validate" && request.method === "GET") return await displayValidate(request, env);
      if (url.pathname === "/auth/display-accounts" && request.method === "GET") return await listDisplayAccounts(request, env);
      if (url.pathname === "/auth/display-accounts" && request.method === "POST") return await createDisplayAccount(request, env);
      if (url.pathname === "/auth/display-account" && request.method === "POST") return await setDisplayAccount(request, env);
      if (url.pathname === "/auth/display-revoke-session" && request.method === "POST") return await revokeDisplaySession(request, env);
      if (url.pathname === "/auth/display-permissions" && request.method === "POST") return await setDisplayPermissions(request, env);
      if (url.pathname === "/auth/display-emergency-lock" && request.method === "POST") return await setDisplayEmergencyLock(request, env);
      if (url.pathname === "/auth/display-activity" && request.method === "GET") return await listDisplayActivity(request, env);
      if (url.pathname === "/sync/role" && request.method === "GET") return await role(request, env);
      if (url.pathname === "/sync/pulse" && request.method === "GET") return await syncPulse(request, env);
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
