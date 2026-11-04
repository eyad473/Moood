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

/* ===== V71: حساب رئيسي (Admin) + جلسات متعددة + تشفير PBKDF2 ===== */
const SESSION_MS = 1000 * 60 * 60 * 24 * 30;
const ADMIN_SESSION_MS = 1000 * 60 * 60 * 24 * 365; /* الحساب الرئيسي: جلسة سنة تتجدد مع الاستخدام */
const MAX_SESSIONS_PER_ACCOUNT = 25;
const PBKDF2_ITERATIONS = 100000;
function timingSafeEq(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
async function pbkdf2Hex(password, salt) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(password)), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(String(salt)), iterations: PBKDF2_ITERATIONS }, key, 256);
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, "0")).join("");
}
async function makePasswordHash(salt, password) { return "p1:" + await pbkdf2Hex(password, salt); }
async function verifyPassword(row, password) {
  const stored = String(row.password_hash || "");
  if (stored.startsWith("p1:")) return timingSafeEq(stored, await makePasswordHash(row.password_salt, password));
  return timingSafeEq(stored, await hashText(String(row.password_salt) + password)); // حسابات قديمة
}
function bearerToken(request) {
  const auth = request.headers.get("Authorization") || "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : "";
}
async function createSession(env, accountId, token, deviceId, isAdmin = false) {
  const t = now(), ms = isAdmin ? ADMIN_SESSION_MS : SESSION_MS;
  await env.DB.prepare(`DELETE FROM auth_sessions WHERE expires_at<?`).bind(t).run();
  await env.DB.prepare(`INSERT INTO auth_sessions(token_hash,account_id,device_id,created_at,expires_at,last_seen_at) VALUES(?,?,?,?,?,?)`).bind(await hashText(token), accountId, cleanString(deviceId, 120), t, t + ms, t).run();
  await env.DB.prepare(`DELETE FROM auth_sessions WHERE account_id=? AND token_hash NOT IN (SELECT token_hash FROM auth_sessions WHERE account_id=? ORDER BY created_at DESC LIMIT ?)`).bind(accountId, accountId, MAX_SESSIONS_PER_ACCOUNT).run();
  return t + ms;
}

/* حساب رئيسي دائم من متغيرات سرية: ADMIN_USERNAME و ADMIN_PASSWORD (Secrets في Cloudflare).
   يُنشأ/يُحدَّث تلقائياً فقط عند تغيّر قيمتهما، فتغيير كلمة المرور من البرنامج يبقى فعّالاً. */
let seededAdminFp = "";
async function seedAdminFromEnv(env) {
  const u = cleanString(env.ADMIN_USERNAME, 120).toLowerCase(), p = String(env.ADMIN_PASSWORD || "");
  if (!u || p.length < 8 || !/^[a-zA-Z0-9._-]{3,}$/.test(u)) return;
  const fp = await hashText(u + "\n" + p);
  if (seededAdminFp === fp) return;
  await ensureAuthSchema(env);
  if (await getMeta(env, "admin_env_fp") !== fp) {
    const row = await env.DB.prepare(`SELECT id FROM display_accounts WHERE username=? LIMIT 1`).bind(u).first();
    const salt = randomToken(), ph = await makePasswordHash(salt, p), t = now();
    if (row) {
      await env.DB.prepare(`UPDATE display_accounts SET role='admin',enabled=1,password_salt=?,password_hash=?,failed_attempts=0,locked_until=NULL,emergency_locked=0,updated_at=? WHERE id=?`).bind(salt, ph, t, Number(row.id)).run();
      await env.DB.prepare(`DELETE FROM auth_sessions WHERE account_id=?`).bind(Number(row.id)).run();
    } else {
      await env.DB.prepare(`INSERT INTO display_accounts(full_name,username,password_salt,password_hash,enabled,created_at,updated_at,role,permissions_json) VALUES(?,?,?,?,1,?,?,'admin',?)`).bind("المدير", u, salt, ph, t, t, JSON.stringify(DEFAULT_DISPLAY_PERMISSIONS)).run();
    }
    await setMeta(env, "admin_env_fp", fp);
    resetAdminCache();
  }
  seededAdminFp = fp;
}
let adminCache = { v: null, t: 0 };
function resetAdminCache() { adminCache = { v: null, t: 0 }; }
async function adminConfigured(env) {
  const t = now();
  if (adminCache.v !== null && t - adminCache.t < 5000) return adminCache.v;
  await ensureAuthSchema(env);
  await seedAdminFromEnv(env);
  const r = await env.DB.prepare(`SELECT id FROM display_accounts WHERE role='admin' AND enabled=1 LIMIT 1`).first();
  adminCache = { v: !!r, t };
  return !!r;
}
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
    ["emergency_locked","ALTER TABLE display_accounts ADD COLUMN emergency_locked INTEGER NOT NULL DEFAULT 0"],
    ["role","ALTER TABLE display_accounts ADD COLUMN role TEXT NOT NULL DEFAULT 'display'"]
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
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS auth_sessions (token_hash TEXT PRIMARY KEY,account_id INTEGER NOT NULL,device_id TEXT,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,last_seen_at INTEGER)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_auth_sessions_account ON auth_sessions(account_id,created_at DESC)`),
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
async function displaySession(request,env){
  await ensureAuthSchema(env);
  const token=bearerToken(request);
  if(!token)return {ok:false,error:"تسجيل الدخول مطلوب",code:"DISPLAY_AUTH_REQUIRED"};
  const sh=await hashText(token);
  let row=await env.DB.prepare(`SELECT a.id,a.full_name,a.username,a.role,a.enabled,a.emergency_locked,a.permissions_json,s.expires_at AS session_expires_at,s.last_seen_at AS seen_at,1 AS via_session FROM auth_sessions s JOIN display_accounts a ON a.id=s.account_id WHERE s.token_hash=? LIMIT 1`).bind(sh).first();
  if(!row){
    // جلسات قديمة (قبل V71) ما زالت صالحة
    row=await env.DB.prepare(`SELECT id,full_name,username,role,enabled,emergency_locked,permissions_json,session_expires_at,last_seen_at AS seen_at,0 AS via_session FROM display_accounts WHERE session_hash=? LIMIT 1`).bind(sh).first();
  }
  if(!row)return {ok:false,error:"جلسة الدخول غير صالحة",code:"DISPLAY_AUTH_REQUIRED"};
  const isAdmin=String(row.role||"")==="admin";
  if(Number(row.enabled)!==1)return {ok:false,error:"تم إيقاف الحساب",code:"DISPLAY_DISABLED"};
  if(!isAdmin&&Number(row.emergency_locked)===1)return {ok:false,error:"تم قفل جهاز العرض مؤقتاً من الجهاز الرئيسي",code:"DISPLAY_EMERGENCY_LOCK"};
  if(Number(row.session_expires_at||0)<now())return {ok:false,error:"انتهت جلسة الدخول، سجّل الدخول من جديد",code:"DISPLAY_AUTH_REQUIRED"};
  if(!row.seen_at || now()-Number(row.seen_at)>30000){
    const t=now();
    await env.DB.prepare(`UPDATE display_accounts SET last_seen_at=? WHERE id=?`).bind(t,Number(row.id)).run();
    if(Number(row.via_session)===1)await env.DB.prepare(`UPDATE auth_sessions SET last_seen_at=?,expires_at=? WHERE token_hash=?`).bind(t,t+(isAdmin?ADMIN_SESSION_MS:SESSION_MS),sh).run();
  }
  return {ok:true,accountId:Number(row.id),fullName:cleanString(row.full_name,200),username:cleanString(row.username,120),role:isAdmin?"admin":"display",permissions:parseDisplayPermissions(row.permissions_json),expiresAt:Number(row.session_expires_at||0)}
}
async function requireDisplayOrPrimary(request,env){
  const a=requireAuth(request,env);if(!a.ok)return a;
  if(await adminConfigured(env)){
    const d=await displaySession(request,env);
    if(!d.ok)return {ok:false,error:d.error,code:d.code||"AUTH"};
    if(d.role==="admin")return {ok:true,deviceId:a.deviceId,primaryDeviceId:a.deviceId,role:"primary",admin:true,accountId:d.accountId,username:d.username};
    return {...d,role:"display"};
  }
  const p=await requirePrimaryDevice(request,env);if(p.ok)return {...p,role:"primary"};
  const d=await displaySession(request,env);if(d.ok)return {...d,role:"display"};
  return {ok:false,error:d.error,code:d.code||p.code||"AUTH"}
}
async function displayLogin(request,env){
  await ensureAuthSchema(env);
  await seedAdminFromEnv(env);
  let body;try{body=await request.json()}catch{return json({ok:false,error:"بيانات الدخول غير صالحة"},400)}
  const username=cleanString(body.username,120).toLowerCase(),password=String(body.password||"");
  if(!username||password.length<6)return json({ok:false,error:"اسم المستخدم وكلمة المرور مطلوبان"},400);
  const row=await env.DB.prepare(`SELECT id,full_name,username,role,password_salt,password_hash,enabled,failed_attempts,locked_until,permissions_json,emergency_locked FROM display_accounts WHERE username=? LIMIT 1`).bind(username).first();
  if(!row)return json({ok:false,error:"اسم المستخدم أو كلمة المرور غير صحيحة",code:"BAD_LOGIN"},401);
  const locked=Number(row.locked_until||0)>now();
  if(locked){const sec=Math.max(1,Math.ceil((Number(row.locked_until)-now())/1000));return json({ok:false,error:`تم إيقاف محاولات الدخول مؤقتًا — حاول بعد ${sec} ثانية`,code:"LOGIN_LOCKED",retryAfter:sec},429)}
  if(Number(row.enabled)!==1)return json({ok:false,error:"تم إيقاف حساب جهاز العرض من الجهاز الرئيسي",code:"DISPLAY_DISABLED"},403);
  const rowIsAdmin=String(row.role||"")==="admin";
  if(!rowIsAdmin&&Number(row.emergency_locked)===1)return json({ok:false,error:"تم قفل جهاز العرض مؤقتاً من الجهاز الرئيسي",code:"DISPLAY_EMERGENCY_LOCK"},403);
  if(!(await verifyPassword(row,password))){
    const attempts=Number(row.failed_attempts||0)+1;
    const lockUntil=attempts>=5?now()+60000:null;
    await env.DB.prepare(`UPDATE display_accounts SET failed_attempts=?,locked_until=?,updated_at=? WHERE id=?`).bind(lockUntil?0:attempts,lockUntil,now(),Number(row.id)).run();
    if(lockUntil)return json({ok:false,error:"تم إيقاف محاولات الدخول مؤقتًا — حاول بعد 60 ثانية",code:"LOGIN_LOCKED",retryAfter:60},429);
    return json({ok:false,error:"اسم المستخدم أو كلمة المرور غير صحيحة",code:"BAD_LOGIN",attemptsRemaining:Math.max(0,5-attempts)},401);
  }
  const token=randomToken();
  const expires=await createSession(env,Number(row.id),token,request.headers.get("X-Device-Id")||String(body.deviceId||""),rowIsAdmin);
  await env.DB.prepare(`UPDATE display_accounts SET last_login_at=?,last_seen_at=?,failed_attempts=0,locked_until=NULL,updated_at=? WHERE id=?`).bind(now(),now(),now(),Number(row.id)).run();
  await logDisplayActivity(env,Number(row.id),cleanString(row.username,120),"تسجيل دخول","تم تسجيل الدخول بنجاح",request.headers.get("X-Device-Id")||"");
  return json({ok:true,token,expiresAt:expires,role:rowIsAdmin?"admin":"display",isAdmin:rowIsAdmin,displayName:cleanString(row.full_name,200),username:cleanString(row.username,120),permissions:parseDisplayPermissions(row.permissions_json)});
}

async function adminSetup(request,env){
  const auth=requireAuth(request,env);if(!auth.ok)return json({ok:false,error:auth.error},401);
  await ensureAuthSchema(env);
  let body;try{body=await request.json()}catch{return json({ok:false,error:"JSON غير صالح"},400)}
  const fullName=cleanString(body.fullName,200)||"المدير",username=cleanString(body.username,120).toLowerCase(),password=String(body.password||"");
  if(username.length<3||!/^[a-zA-Z0-9._-]+$/.test(username))return json({ok:false,error:"اسم المستخدم: 3 أحرف على الأقل، أحرف إنجليزية وأرقام و . _ - فقط"},400);
  if(password.length<8)return json({ok:false,error:"كلمة مرور الحساب الرئيسي يجب أن تكون 8 أحرف على الأقل"},400);
  if(await adminConfigured(env))return json({ok:false,error:"الحساب الرئيسي موجود بالفعل — استخدم تغيير كلمة المرور",code:"ADMIN_EXISTS"},409);
  if(!auth.deviceId)return json({ok:false,error:"معرّف الجهاز مفقود"},400);
  const primary=await getPrimaryDevice(env);
  if(primary&&auth.deviceId!==primary)return json({ok:false,error:"إنشاء الحساب الرئيسي مسموح من الجهاز الرئيسي الحالي فقط",code:"READ_ONLY"},403);
  const exists=await env.DB.prepare(`SELECT id FROM display_accounts WHERE username=? LIMIT 1`).bind(username).first();
  if(exists)return json({ok:false,error:"اسم المستخدم مستخدم بالفعل",code:"USERNAME_EXISTS"},409);
  const salt=randomToken(),ph=await makePasswordHash(salt,password),t=now();
  const res=await env.DB.prepare(`INSERT INTO display_accounts(full_name,username,password_salt,password_hash,enabled,created_at,updated_at,role,permissions_json) VALUES(?,?,?,?,1,?,?,'admin',?)`).bind(fullName,username,salt,ph,t,t,JSON.stringify(DEFAULT_DISPLAY_PERMISSIONS)).run();
  const id=Number(res.meta?.last_row_id||0);if(!id)throw new Error("تعذر إنشاء الحساب الرئيسي");
  resetAdminCache();
  const token=randomToken();const expiresAt=await createSession(env,id,token,auth.deviceId,true);
  await logDisplayActivity(env,id,username,"إنشاء الحساب الرئيسي","",auth.deviceId);
  return json({ok:true,token,expiresAt,role:"admin",isAdmin:true,displayName:fullName,username});
}
async function adminChangePassword(request,env){
  const auth=await requirePrimaryDevice(request,env);
  if(!auth.ok)return json({ok:false,error:auth.error,code:auth.code||"AUTH"},auth.code==="READ_ONLY"?403:401);
  if(!auth.admin)return json({ok:false,error:"متاح من الحساب الرئيسي فقط"},403);
  let body;try{body=await request.json()}catch{return json({ok:false,error:"JSON غير صالح"},400)}
  const oldPassword=String(body.oldPassword||""),newPassword=String(body.newPassword||"");
  if(newPassword.length<8)return json({ok:false,error:"كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل"},400);
  const row=await env.DB.prepare(`SELECT id,username,password_salt,password_hash FROM display_accounts WHERE id=? AND role='admin'`).bind(auth.accountId).first();
  if(!row||!(await verifyPassword(row,oldPassword)))return json({ok:false,error:"كلمة المرور الحالية غير صحيحة",code:"BAD_LOGIN"},401);
  const salt=randomToken(),ph=await makePasswordHash(salt,newPassword),keep=await hashText(bearerToken(request));
  await env.DB.prepare(`UPDATE display_accounts SET password_salt=?,password_hash=?,updated_at=? WHERE id=?`).bind(salt,ph,now(),auth.accountId).run();
  await env.DB.prepare(`DELETE FROM auth_sessions WHERE account_id=? AND token_hash!=?`).bind(auth.accountId,keep).run();
  await logDisplayActivity(env,auth.accountId,row.username,"تغيير كلمة مرور الحساب الرئيسي","",request.headers.get("X-Device-Id")||"");
  return json({ok:true});
}
async function authLogout(request,env){
  await ensureAuthSchema(env);
  const token=bearerToken(request);
  if(token){const sh=await hashText(token);await env.DB.prepare(`DELETE FROM auth_sessions WHERE token_hash=?`).bind(sh).run();await env.DB.prepare(`UPDATE display_accounts SET session_hash=NULL,session_expires_at=NULL WHERE session_hash=?`).bind(sh).run()}
  return json({ok:true});
}
async function displayValidate(request,env){const d=await displaySession(request,env);if(!d.ok)return json({ok:false,error:d.error,code:d.code},d.code==="DISPLAY_DISABLED"?403:401);return json({ok:true,role:d.role,isAdmin:d.role==="admin",displayName:d.fullName,username:d.username,permissions:d.permissions,expiresAt:d.expiresAt})}
async function listDisplayAccounts(request,env){const auth=await requirePrimaryDevice(request,env);if(!auth.ok)return json({ok:false,error:auth.error,code:auth.code||"AUTH"},auth.code==="READ_ONLY"?403:401);await ensureAuthSchema(env);const rows=await env.DB.prepare(`SELECT id,full_name,username,enabled,emergency_locked,permissions_json,created_at,updated_at,last_login_at,last_seen_at,session_expires_at FROM display_accounts WHERE role!='admin' ORDER BY id DESC`).all();return json({ok:true,accounts:(rows.results||[]).map(r=>({id:Number(r.id),fullName:r.full_name,username:r.username,enabled:Number(r.enabled)===1,emergencyLocked:Number(r.emergency_locked)===1,permissions:parseDisplayPermissions(r.permissions_json),sessionExpiresAt:r.session_expires_at?Number(r.session_expires_at):null,createdAt:Number(r.created_at),updatedAt:Number(r.updated_at),lastLoginAt:r.last_login_at?Number(r.last_login_at):null,lastSeenAt:r.last_seen_at?Number(r.last_seen_at):null}))})}
async function createDisplayAccount(request,env){const requestId=cleanString(request.headers.get("X-Request-Id")||crypto.randomUUID(),80);try{const auth=await requirePrimaryDevice(request,env);if(!auth.ok)return json({ok:false,error:auth.error,code:auth.code||"AUTH",requestId},auth.code==="READ_ONLY"?403:401);await ensureAuthSchema(env);let body;try{body=await request.json()}catch{return json({ok:false,error:"JSON غير صالح",requestId},400)}const fullName=cleanString(body.fullName,200),username=cleanString(body.username,120).toLowerCase(),password=String(body.password||"");if(fullName.length<3||username.length<3||password.length<6)return json({ok:false,error:"أدخل الاسم الرباعي واسم مستخدم من 3 أحرف على الأقل وكلمة مرور من 6 أحرف على الأقل",requestId},400);if(!/^[a-zA-Z0-9._-]+$/.test(username))return json({ok:false,error:"اسم المستخدم يجب أن يحتوي على أحرف إنجليزية وأرقام و . _ - فقط",requestId},400);const exists=await env.DB.prepare(`SELECT id,full_name,username FROM display_accounts WHERE username=? LIMIT 1`).bind(username).first();if(exists)return json({ok:false,error:"اسم المستخدم مستخدم بالفعل",code:"USERNAME_EXISTS",requestId,accountId:Number(exists.id)},409);const salt=randomToken(),ph=await makePasswordHash(salt,password),t=now();const res=await env.DB.prepare(`INSERT INTO display_accounts(full_name,username,password_salt,password_hash,enabled,created_at,updated_at) VALUES(?,?,?,?,1,?,?)`).bind(fullName,username,salt,ph,t,t).run();const id=Number(res.meta?.last_row_id||0);if(!id)throw new Error("تم تنفيذ الحفظ دون إرجاع رقم الحساب");try{await env.DB.prepare(`UPDATE display_accounts SET permissions_json=?,emergency_locked=0 WHERE id=?`).bind(JSON.stringify(DEFAULT_DISPLAY_PERMISSIONS),id).run()}catch(e){throw new Error(`تم إنشاء الحساب لكن تعذر حفظ إعداداته الإضافية: ${e?.message||e}`)}await logDisplayActivity(env,id,username,"إنشاء حساب جهاز عرض","تم إنشاء الحساب من الجهاز الرئيسي",request.headers.get("X-Device-Id")||"");return json({ok:true,id,fullName,username,requestId})}catch(e){return json({ok:false,error:`تعذر إنشاء حساب جهاز العرض: ${e?.message||e}`,code:"DISPLAY_ACCOUNT_CREATE_FAILED",requestId},500)}}
async function revokeDisplaySession(request,env){await ensureAuthSchema(env);const auth=await requirePrimaryDevice(request,env);if(!auth.ok)return json({ok:false,error:auth.error,code:auth.code||"AUTH"},auth.code==="READ_ONLY"?403:401);let body;try{body=await request.json()}catch{return json({ok:false,error:"JSON غير صالح"},400)}const id=Number(body.id||0);if(!id)return json({ok:false,error:"معرّف الحساب مفقود"},400);const r=await env.DB.prepare(`UPDATE display_accounts SET session_hash=NULL,session_expires_at=NULL,updated_at=? WHERE id=? AND role!='admin'`).bind(now(),id).run();if(!r.meta?.changes)return json({ok:false,error:"حساب جهاز العرض غير موجود"},404);await env.DB.prepare(`DELETE FROM auth_sessions WHERE account_id=?`).bind(id).run();await logDisplayActivity(env,id,"","إنهاء جلسة عن بُعد","",request.headers.get("X-Device-Id")||"");return json({ok:true})}
async function setDisplayAccount(request,env){const auth=await requirePrimaryDevice(request,env);if(!auth.ok)return json({ok:false,error:auth.error,code:auth.code||"AUTH"},auth.code==="READ_ONLY"?403:401);await ensureAuthSchema(env);let body;try{body=await request.json()}catch{return json({ok:false,error:"JSON غير صالح"},400)}const id=Number(body.id||0);if(!id)return json({ok:false,error:"معرّف الحساب مفقود"},400);const exists=await env.DB.prepare(`SELECT id FROM display_accounts WHERE id=? AND role!='admin'`).bind(id).first();if(!exists)return json({ok:false,error:"حساب جهاز العرض غير موجود"},404);const enabled=body.enabled===true,password=String(body.password||"");if(password){if(password.length<6)return json({ok:false,error:"كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل"},400);const salt=randomToken(),ph=await makePasswordHash(salt,password);await env.DB.prepare(`DELETE FROM auth_sessions WHERE account_id=?`).bind(id).run();await env.DB.prepare(`UPDATE display_accounts SET enabled=?,password_salt=?,password_hash=?,session_hash=NULL,session_expires_at=NULL,updated_at=? WHERE id=?`).bind(enabled?1:0,salt,ph,now(),id).run()}else{if(enabled)await env.DB.prepare(`UPDATE display_accounts SET enabled=1,updated_at=? WHERE id=?`).bind(now(),id).run();else{await env.DB.prepare(`UPDATE display_accounts SET enabled=0,session_hash=NULL,session_expires_at=NULL,updated_at=? WHERE id=?`).bind(now(),id).run();await env.DB.prepare(`DELETE FROM auth_sessions WHERE account_id=?`).bind(id).run()}}await logDisplayActivity(env,id,"","تحديث الحساب",password?"تغيير كلمة المرور":"تغيير حالة الحساب",request.headers.get("X-Device-Id")||"");return json({ok:true})}

async function setDisplayPermissions(request,env){const auth=await requirePrimaryDevice(request,env);if(!auth.ok)return json({ok:false,error:auth.error,code:auth.code||"AUTH"},auth.code==="READ_ONLY"?403:401);await ensureAuthSchema(env);let body;try{body=await request.json()}catch{return json({ok:false,error:"JSON غير صالح"},400)}const id=Number(body.id||0);const row=await env.DB.prepare(`SELECT id,username FROM display_accounts WHERE id=? AND role!='admin'`).bind(id).first();if(!row)return json({ok:false,error:"حساب جهاز العرض غير موجود"},404);const perms=normalizeDisplayPermissions(body.permissions);await env.DB.prepare(`UPDATE display_accounts SET permissions_json=?,updated_at=? WHERE id=?`).bind(JSON.stringify(perms),now(),id).run();await logDisplayActivity(env,id,row.username,"تغيير الصلاحيات",JSON.stringify(perms),request.headers.get("X-Device-Id")||"");return json({ok:true,permissions:perms})}
async function setDisplayEmergencyLock(request,env){const auth=await requirePrimaryDevice(request,env);if(!auth.ok)return json({ok:false,error:auth.error,code:auth.code||"AUTH"},auth.code==="READ_ONLY"?403:401);await ensureAuthSchema(env);let body;try{body=await request.json()}catch{return json({ok:false,error:"JSON غير صالح"},400)}const id=Number(body.id||0),locked=body.locked===true;const row=await env.DB.prepare(`SELECT id,username FROM display_accounts WHERE id=? AND role!='admin'`).bind(id).first();if(!row)return json({ok:false,error:"حساب جهاز العرض غير موجود"},404);await env.DB.prepare(`UPDATE display_accounts SET emergency_locked=?,session_hash=CASE WHEN ?=1 THEN NULL ELSE session_hash END,session_expires_at=CASE WHEN ?=1 THEN NULL ELSE session_expires_at END,updated_at=? WHERE id=?`).bind(locked?1:0,locked?1:0,locked?1:0,now(),id).run();await logDisplayActivity(env,id,row.username,locked?"قفل طوارئ":"إلغاء قفل الطوارئ",locked?"تم إيقاف الوصول فوراً":"تم السماح بالدخول",request.headers.get("X-Device-Id")||"");return json({ok:true,locked})}
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
  // V71: بعد إنشاء الحساب الرئيسي، الصلاحية الكاملة للحساب فقط (من أي جهاز) وليست للجهاز.
  if (await adminConfigured(env)) {
    const s = await displaySession(request, env);
    if (s.ok && s.role === "admin") return { ok: true, deviceId: auth.deviceId, primaryDeviceId: auth.deviceId, admin: true, accountId: s.accountId, username: s.username };
    if (s.ok) return { ok: false, error: "هذا الحساب للعرض فقط؛ التعديل مسموح من الحساب الرئيسي فقط", code: "READ_ONLY" };
    return { ok: false, error: s.error || "تسجيل الدخول مطلوب", code: s.code || "AUTH" };
  }
  // قبل إنشاء حساب رئيسي: النظام القديم (جهاز رئيسي بالمعرّف)
  const primary = await getPrimaryDevice(env);
  if (!primary) return { ok: false, error: "لم يتم تعيين جهاز رئيسي بعد", code: "NO_PRIMARY" };
  if (auth.deviceId !== primary) return { ok: false, error: "هذا الجهاز للعرض فقط؛ التعديل مسموح من الجهاز الرئيسي فقط", code: "READ_ONLY" };
  return { ok: true, deviceId: auth.deviceId, primaryDeviceId: primary };
}

async function resolveRoleState(request, env, auth) {
  const adminOn = await adminConfigured(env);
  const display = await displaySession(request, env);
  const primary = await getPrimaryDevice(env);
  const isPrimary = adminOn ? (display.ok && display.role === "admin") : (!!primary && auth.deviceId === primary);
  return { adminOn, display, primary, isPrimary };
}

async function role(request, env) {
  const auth=requireAuth(request,env); if(!auth.ok)return json({ok:false,error:auth.error},401);
  const { adminOn, display, primary, isPrimary } = await resolveRoleState(request, env, auth);
  const ready=(await getMeta(env,"authoritative_snapshot_at"))!==""; const count=Number(await getMeta(env,"authoritative_record_count")||0); const generation=Number(await getMeta(env,"authoritative_generation")||0);
  const base={ok:true,deviceId:auth.deviceId,primaryDeviceId:primary||null,isPrimary,isAdmin:adminOn&&isPrimary,adminConfigured:adminOn,configured:adminOn||!!primary,authoritativeReady:ready,authoritativeRecordCount:count,authoritativeGeneration:generation};
  if(!isPrimary && !display.ok) return json({...base,displayAuthenticated:false,displayAuthRequired:true},200);
  const isDisp=display.ok&&display.role!=="admin";
  return json({...base,displayAuthenticated:!!display.ok,displayAuthRequired:false,displayName:display.ok?display.fullName:"",displayUsername:display.ok?display.username:"",displayPermissions:isDisp?display.permissions:null,displaySessionExpiresAt:display.ok?display.expiresAt:null});
}

async function syncPulse(request, env) {
  const auth = requireAuth(request, env);
  if (!auth.ok) return json({ok:false,error:auth.error,code:"AUTH"},401);
  const { display, isPrimary } = await resolveRoleState(request, env, auth);
  if (!isPrimary && !display.ok) return json({ok:false,error:display.error,code:display.code||"DISPLAY_AUTH_REQUIRED",displayAuthRequired:true}, display.code === "DISPLAY_DISABLED" || display.code === "DISPLAY_EMERGENCY_LOCK" ? 403 : 401);
  const isDisp = display.ok && display.role !== "admin";
  const ready = (await getMeta(env,"authoritative_snapshot_at")) !== "";
  const generation = Number(await getMeta(env,"authoritative_generation") || 0);
  const count = await activeAuthoritativeCount(env);
  return json({ok:true,isPrimary,authoritativeReady:ready,authoritativeGeneration:generation,authoritativeRecordCount:count,actualRecordCount:count,safeReconcile:true,displayAuthenticated:!!display.ok,displayPermissions:isDisp?display.permissions:null,displaySessionExpiresAt:display.ok?display.expiresAt:null,serverTime:now()});
}

async function claimPrimary(request, env) {
  const auth = requireAuth(request, env);
  if (!auth.ok) return json({ ok:false, error:auth.error }, 401);
  if (!auth.deviceId) return json({ ok:false, error:"معرّف الجهاز مفقود" }, 400);
  await ensureSchema(env);
  if (await adminConfigured(env)) return json({ ok:false, error:"تم تفعيل الحساب الرئيسي؛ سجّل الدخول به بدل تعيين جهاز رئيسي", code:"ADMIN_EXISTS" }, 409);
  const current = await getPrimaryDevice(env);
  if (current && current !== auth.deviceId) return json({ ok:false, error:"يوجد جهاز رئيسي محدد بالفعل", primaryDeviceId:current }, 409);
  await env.DB.prepare("INSERT INTO sync_meta(key,value) VALUES('primary_device_id',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(auth.deviceId).run();
  const ready = (await getMeta(env,"authoritative_snapshot_at")) !== "";
  return json({ ok:true, deviceId:auth.deviceId, primaryDeviceId:auth.deviceId, isPrimary:true, authoritativeReady:ready });
}

async function health(env) {
  try {
    await ensureSchema(env);
    const count = await activeAuthoritativeCount(env);
    const metaCount = Number(await getMeta(env,"authoritative_record_count") || 0);
    const seq = Number(await getMeta(env,"latest_seq") || 0);
    const ready = (await getMeta(env,"authoritative_snapshot_at")) !== "";
    return json({
      ok: true, worker: "moood", database: "mood", binding: "DB",
      safeReconcile: true, records: count, activeRecords: count, metaRecordCount: metaCount, latestSeq: seq,
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

  /* V72: حارس الحذف الجماعي. دفعة واحدة تحذف أكثر من MASS_DELETE_LIMIT سجل أسرة تُرفض كاملة ولا يُكتب منها شيء.
     السماح المؤقت يتم فقط بقرار صريح: sync_meta.allow_mass_delete_until = وقت (ms) في المستقبل. */
  const MASS_DELETE_LIMIT = 30;
  const familyDeletes = incoming.filter(x => x && x.operation === "delete" && String(x.recordId || "").startsWith("r-")).length;
  if (familyDeletes > MASS_DELETE_LIMIT) {
    const until = Number(await getMeta(env, "allow_mass_delete_until") || 0);
    if (!(until > now())) {
      return json({ ok:false, code:"MASS_DELETE_BLOCKED", error:`تم رفض دفعة تحذف ${familyDeletes} أسرة دفعة واحدة (الحد ${MASS_DELETE_LIMIT}). لم يُحذف شيء.`, deletes:familyDeletes, limit:MASS_DELETE_LIMIT, accepted:[], conflicts:[], skipped:[] }, 409);
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
    // EMERGENCY DATA PROTECTION: temporarily reject ALL family record deletions.
    // Do not remove until authenticated deletion audit and recovery are deployed.
    if (operation === "delete" && recordId.startsWith("r-")) {
      conflicts.push({opId: cleanString(item.opId,200), recordId, reason:"حذف الأسر معطل مؤقتاً لحماية البيانات", code:"FAMILY_DELETE_LOCKED"});
      continue;
    }
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
      SELECT record_id, updated_at, version, deleted, data_json
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
        /* V72: الحذف المنطقي يحتفظ بآخر بيانات السجل (لا تُمسح إلى {}) ليسهل الاسترجاع. كل القراءات تستثني deleted=1. */
        dataJson ?? (current?.data_json || "{}"),
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
    await setMeta(env,"authoritative_record_count", await activeAuthoritativeCount(env));
  }
  return json({ ok:true, accepted, conflicts, skipped, latestSeq:Number(latest?.seq||0), authoritativeGeneration });
}

/* ===== V72: primary-reconcile آمن =====
   - لا حذف نهائياً ولا حذف منطقي بسبب غياب السجل عن incoming.
   - لا إحياء لسجل محذوف، ولا استبدال لسجل موجود.
   - يُدخل فقط سجلاً غير موجود إطلاقاً في sync_records (بقيد ON CONFLICT DO NOTHING لمنع التكرار).
   - كل الأعداد المعادة وقيم authoritative_* مصدرها قاعدة البيانات لا الجهاز.
   - kill switch: المتغير PRIMARY_RECONCILE_MODE=off أو sync_meta.primary_reconcile_mode=off => لا كتابة إطلاقاً.
   - body.dryRun=true => تقرير مقارنة فقط دون أي كتابة. */
async function activeAuthoritativeCount(env) {
  const r = await env.DB.prepare("SELECT COUNT(*) AS c FROM sync_records WHERE deleted=0 AND record_id LIKE 'r-%'").first();
  return Number(r?.c || 0);
}
async function primaryReconcileMode(env) {
  const fromEnv = cleanString(env.PRIMARY_RECONCILE_MODE || "", 20).toLowerCase();
  const m = fromEnv || (await getMeta(env, "primary_reconcile_mode")).toLowerCase();
  return m === "off" ? "off" : "safe";
}
function reconcileLabel(id, data) {
  return { recordId: id, headName: cleanString(data?.["اسم رب الأسرة"], 120), name: cleanString(data?.["اسم الفرد"], 120) };
}
async function primaryReconcile(request, env) {
  const auth = await requirePrimaryDevice(request, env);
  if (!auth.ok) return json({ok:false,error:auth.error,code:auth.code||"AUTH"}, auth.code==="READ_ONLY"?403:409);
  await ensureSchema(env);
  let body; try { body=await request.json(); } catch { return json({ok:false,error:"JSON غير صالح"},400); }
  const records=Array.isArray(body.records)?body.records:[];
  if(records.length>5000) return json({ok:false,error:"عدد السجلات كبير"},413);
  const mode = await primaryReconcileMode(env);
  const dryRun = body.dryRun === true || mode === "off";

  const current=await env.DB.prepare("SELECT record_id,data_json,version,deleted FROM sync_records WHERE record_id LIKE 'r-%'").all();
  const existing=new Map((current.results||[]).map(r=>[String(r.record_id),r]));
  const incoming=new Map();
  for(const item of records){
    const id=cleanString(item?.recordId,200);
    if(!id || !id.startsWith("r-")) continue;
    if(!item.data || typeof item.data!=="object") continue;
    incoming.set(id,item.data);
  }

  const toInsert=[], deletedOnServer=[], differing=[], missingFromIncoming=[];
  for(const [id,data] of incoming){
    const old=existing.get(id);
    if(!old) toInsert.push([id,data]);
    else if(Number(old.deleted)===1) deletedOnServer.push(id);
    else if(old.data_json!==JSON.stringify(data)) differing.push(id);
  }
  for(const [id,old] of existing){
    if(Number(old.deleted)===1 || incoming.has(id)) continue;
    let d={}; try{ d=JSON.parse(old.data_json||"{}"); }catch{}
    missingFromIncoming.push(reconcileLabel(id,d));
  }

  const t=now(); let inserted=0;
  if(!dryRun && toInsert.length){
    for(let i=0;i<toInsert.length;i+=50){
      const stmts=[];
      for(const [id,data] of toInsert.slice(i,i+50)){
        const dataJson=JSON.stringify(data);
        stmts.push(
          env.DB.prepare(`INSERT INTO sync_records(record_id,data_json,updated_at,version,deleted,updated_by,created_at) VALUES(?,?,?,1,0,?,?) ON CONFLICT(record_id) DO NOTHING`).bind(id,dataJson,t,auth.deviceId,t),
          env.DB.prepare(`INSERT INTO sync_changes(op_id,record_id,operation,data_json,updated_at,version,device_id,created_at) VALUES(?,?,'upsert',?,?,1,?,?)`).bind(crypto.randomUUID(),id,dataJson,t,auth.deviceId,t)
        );
      }
      await env.DB.batch(stmts);
      inserted+=stmts.length/2;
    }
  }

  const actualActive=await activeAuthoritativeCount(env);
  let authoritativeGeneration = Number(await getMeta(env,"authoritative_generation") || 0);
  if(!dryRun){
    // قيم metadata تُحسب من قاعدة البيانات فقط، لا من incoming.
    if(inserted>0){
      authoritativeGeneration += 1;
      await setMeta(env,"authoritative_generation",authoritativeGeneration);
      await setMeta(env,"authoritative_snapshot_at",t);
    } else if((await getMeta(env,"authoritative_snapshot_at"))===""){
      await setMeta(env,"authoritative_snapshot_at",t);
    }
    await setMeta(env,"authoritative_record_count",actualActive);
  }
  const latest=await env.DB.prepare("SELECT seq FROM sync_changes ORDER BY seq DESC LIMIT 1").first();
  if(!dryRun) await setMeta(env,"latest_seq",Number(latest?.seq||0));
  return json({
    ok:true, safeMode:true, mode, dryRun, skipped: mode==="off",
    authoritativeReady:true, actualActiveCount:actualActive, recordCount:actualActive,
    incomingCount:incoming.size, inserted, deleted:0, changed:inserted,
    insertedIds: toInsert.slice(0,200).map(x=>x[0]),
    missingFromIncomingCount:missingFromIncoming.length, missingFromIncoming,
    deletedOnServerCount:deletedOnServer.length, deletedOnServerIds:deletedOnServer.slice(0,200),
    differingCount:differing.length, differingIds:differing.slice(0,200),
    authoritativeGeneration, latestSeq:Number(latest?.seq||0)
  });
}

/* مسار إداري منفصل وصريح: لا يلمس أي سجل. يقارن metadata بالعدد الفعلي، وعند confirm يصحّح العدد ويزيد generation
   ليجبر الأجهزة على إعادة سحب اللقطة (مثلاً بعد استعادة سجلات مباشرة في D1). */
async function refreshAuthoritativeMeta(request, env) {
  const auth = await requirePrimaryDevice(request, env);
  if (!auth.ok) return json({ok:false,error:auth.error,code:auth.code||"AUTH"}, auth.code==="READ_ONLY"?403:409);
  await ensureSchema(env);
  let body={}; try { body=await request.json(); } catch {}
  const actual=await activeAuthoritativeCount(env);
  const before={ generation:Number(await getMeta(env,"authoritative_generation")||0), recordCount:Number(await getMeta(env,"authoritative_record_count")||0) };
  if(body.confirm!=="REFRESH_AUTHORITATIVE_META") return json({ok:true,applied:false,before,actualActiveCount:actual,note:"تقرير فقط. أرسل confirm=REFRESH_AUTHORITATIVE_META للتطبيق (يكتب metadata فقط)."});
  const generation=before.generation+1;
  await setMeta(env,"authoritative_generation",generation);
  await setMeta(env,"authoritative_record_count",actual);
  await setMeta(env,"authoritative_snapshot_at",now());
  return json({ok:true,applied:true,before,after:{generation,recordCount:actual}});
}


// Phase C1: administrator-only, read-only recovery discovery. No restoration or deletion here.
async function recoveryInspect(request, env) {
  const auth = await requirePrimaryDevice(request, env);
  if (!auth.ok) return json({ok:false,error:auth.error,code:auth.code||"AUTH"},403);
  let body;
  try { body = await request.json(); } catch { return json({ok:false,error:"Invalid JSON"},400); }
  const recordId = cleanString(body?.recordId || "",200);
  if (!/^r-[a-zA-Z0-9-]{3,190}$/.test(recordId)) return json({ok:false,error:"معرف السجل غير صالح"},400);
  await ensureSchema(env);
  const current = await env.DB.prepare(`SELECT record_id,data_json,deleted,version,updated_at FROM sync_records WHERE record_id=?`).bind(recordId).first();
  const history = await env.DB.prepare(`SELECT seq,operation,version,created_at,updated_at,data_json FROM sync_changes WHERE record_id=? ORDER BY seq DESC LIMIT 30`).bind(recordId).all();
  const backups = [];
  const tables = await env.DB.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'sync_records_backup_%' ORDER BY name DESC LIMIT 12`).all();
  for (const t of (tables.results||[])) {
    if (!/^sync_records_backup_[0-9]{8}$/.test(t.name)) continue;
    const row = await env.DB.prepare(`SELECT record_id,data_json,deleted,version,updated_at FROM "${t.name}" WHERE record_id=?`).bind(recordId).first();
    if (row) backups.push({source:t.name,record:row});
  }
  return json({ok:true,recordId,current:current||null,history:history.results||[],backups,readOnly:true});
}
async function recoveryDeletedList(request,env) {
  const auth = await requirePrimaryDevice(request,env);
  if (!auth.ok) return json({ok:false,error:auth.error,code:auth.code||"AUTH"},403);
  await ensureSchema(env);
  const u = new URL(request.url);
  const after = cleanString(u.searchParams.get('after')||'',200);
  const limit = Math.max(1,Math.min(50,Number(u.searchParams.get('limit')||25)||25));
  const r = await env.DB.prepare(`SELECT record_id,version,updated_at FROM sync_records WHERE deleted=1 AND record_id LIKE 'r-%' AND record_id>? ORDER BY record_id LIMIT ?`).bind(after,limit).all();
  const rows = r.results||[];
  return json({ok:true,items:rows,nextAfter:rows.length===limit?rows[rows.length-1].record_id:null,readOnly:true});
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
  const actualRecordCount = await activeAuthoritativeCount(env);
  return json({ok:true,generation,records:rows,nextAfter,hasMore:rows.length===limit,recordCount:actualRecordCount,actualRecordCount,metaRecordCount:Number(await getMeta(env,"authoritative_record_count")||0)});
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
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_support_requests_family_created ON support_requests(family_id,created_at DESC)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_support_requests_status ON support_requests(status,created_at DESC)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS support_attachments (
      id TEXT PRIMARY KEY, ticket_no TEXT NOT NULL, file_name TEXT NOT NULL,
      content_type TEXT NOT NULL, file_size INTEGER NOT NULL, data_base64 TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_support_attachments_ticket ON support_attachments(ticket_no)`),
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
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS support_login_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, family_id TEXT NOT NULL, family_name TEXT,
      event TEXT NOT NULL, device TEXT, country TEXT, created_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_support_login_created ON support_login_log(created_at DESC)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_support_login_family ON support_login_log(family_id,created_at DESC)`)
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
  // الحقول الأساسية التي تعرضها بوابة الأهالي.
  const allow = ["اسم رب الأسرة","رقم هوية الأسرة","رقم الجوال","رقم جوال بديل","العنوان","داخل/خارج المخيم","حالة اكتمال بيانات الأسرة","المحافظة الأصلية","حالة المسكن الأصلي","نوع السكن الحالي","اسم الفرد","صلة القرابة","الجنس","الحالة الاجتماعية","تاريخ الميلاد","العمر التقريبي","رقم هوية الفرد","مرض مزمن؟","نوع المرض","إصابة؟","إصابة?","سبب الإصابة","تفاصيل الإصابة","إعاقة؟","نوع الإعاقة","يتيم/منفصل عن ذويه؟","حامل؟","مرضعة؟","ملاحظات الفرد","ملاحظات الأسرة"];
  const out={};
  if(!r || typeof r !== "object") return out;

  // لا نعتمد على اسم عمود واحد فقط: نمرر كل أعمدة الحالة الصحية الموجودة فعلياً
  // في السجل الرسمي، بما فيها صيغ الأسئلة والتفاصيل المختلفة التي قد يستخدمها
  // إصدار البرنامج الرسمي (مع الحفاظ على اسم الحقل الأصلي حتى تتعرف عليه الواجهة).
  const healthKey = /مرض|إصابة|اصابة|إعاقة|اعاقة|معاق|حامل|حمل|مرضعة|رضاعة|يرضع|صحي|health|injur|disab|pregnan|breastfeed/i;
  const selected = new Set(allow);
  for(const key of Object.keys(r)) {
    if(healthKey.test(String(key))) selected.add(key);
  }
  for(const k of selected) {
    const value=r[k];
    if(value !== undefined && value !== null && String(value).trim() !== "") out[k]=value;
  }
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
  // Ask about a randomly selected registered family member, not always the wife.
  for(const person of rows){
    const birth=supportYear(person['تاريخ الميلاد']||person['سنة الميلاد']);
    if(!birth) continue;
    const name=String(person['اسم الفرد']||person['اسم رب الأسرة']||'').trim();
    const relation=String(person['صلة القرابة']||'').trim();
    const who=name ? `${name}${relation && supportNorm(relation)!==supportNorm('رب الأسرة') ? ` (${relation})` : ''}` : 'أحد أفراد الأسرة';
    candidates.push({key:'',label:`ما سنة ميلاد ${who} المسجّلة في الكشف؟`,answer:birth,kind:'year'});
  }
  const first=rows.find(r=>supportPhone(r['رقم الجوال']).length>=8);
  if(first){
    const phone=supportPhone(first['رقم الجوال']);
    candidates.push({key:'',label:'ما آخر أربعة أرقام من رقم الجوال المسجّل للأسرة؟',answer:phone.slice(-4),kind:'last4'});
  }
  if(rows.length) candidates.push({key:'',label:'كم عدد أفراد الأسرة المسجّلين في الكشف؟',answer:String(rows.length),kind:'count'});

  // Cryptographically shuffle and choose two questions of different kinds.
  for(let i=candidates.length-1;i>0;i--){
    const bytes=new Uint32Array(1); crypto.getRandomValues(bytes);
    const j=bytes[0]%(i+1); [candidates[i],candidates[j]]=[candidates[j],candidates[i]];
  }
  const picked=[];
  for(const candidate of candidates){
    if(!picked.some(x=>x.kind===candidate.kind)) picked.push(candidate);
    if(picked.length===2) break;
  }
  return picked.map((c,i)=>({...c,key:'a'+i}));
}
/* ===== سجل دخول الأهالي إلى البوابة (إضافة) ===== */
function supportDevice(request) {
  const ua = request.headers.get('User-Agent') || '';
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Macintosh|Mac OS/i.test(ua) ? 'Mac' : /Linux/i.test(ua) ? 'Linux' : 'غير معروف';
  const br = /SamsungBrowser/i.test(ua) ? 'Samsung Browser' : /Edg\//i.test(ua) ? 'Edge' : /OPR\/|Opera/i.test(ua) ? 'Opera' : /Firefox|FxiOS/i.test(ua) ? 'Firefox' : /Chrome|CriOS/i.test(ua) ? 'Chrome' : /Safari/i.test(ua) ? 'Safari' : '';
  return br ? os + ' · ' + br : os;
}
// event: login (تحقق جديد) | return (عودة بجلسة قائمة) | logout (خروج) | failed (محاولة فاشلة)
async function logSupportLogin(env, request, familyId, event, familyName = '') {
  try {
    const t = now();
    if (event === 'return') {
      // لا نكرر "العودة" لنفس الأسرة أكثر من مرة كل 30 دقيقة حتى لا يمتلئ السجل
      const last = await env.DB.prepare("SELECT created_at FROM support_login_log WHERE family_id=? AND event IN ('login','return') ORDER BY created_at DESC LIMIT 1").bind(String(familyId)).first();
      if (last && t - Number(last.created_at) < 30 * 60 * 1000) return;
    }
    await env.DB.prepare('INSERT INTO support_login_log(family_id,family_name,event,device,country,created_at) VALUES(?,?,?,?,?,?)')
      .bind(String(familyId), cleanString(familyName, 200), event, supportDevice(request), cleanString(request.cf?.country || '', 8), t).run();
  } catch (e) { /* التسجيل لا يجب أن يعطّل الدخول أبدًا */ }
}
async function supportLogins(request, env) {
  const auth = await requirePrimaryDevice(request, env);
  if (!auth.ok) return json({ ok: false, error: auth.error, code: auth.code || 'AUTH' }, auth.code === 'READ_ONLY' ? 403 : 401);
  await ensureSupportSchema(env);
  const url = new URL(request.url);
  const event = cleanString(url.searchParams.get('event'), 20), q = cleanString(url.searchParams.get('q'), 120);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 100, 1), 500);
  const since = Number(url.searchParams.get('since')) || 0;
  try { await env.DB.prepare('DELETE FROM support_login_log WHERE created_at<?').bind(now() - 180 * 24 * 60 * 60 * 1000).run(); } catch (e) {}
  const where = [], vals = [];
  if (['login', 'return', 'logout', 'failed'].includes(event)) { where.push('event=?'); vals.push(event); }
  if (q) { where.push('(family_id LIKE ? OR name LIKE ?)'); vals.push('%' + q + '%', '%' + q + '%'); }
  const sql = `SELECT * FROM (SELECT l.id, l.family_id, COALESCE(NULLIF(l.family_name,''),(SELECT l2.family_name FROM support_login_log l2 WHERE l2.family_id=l.family_id AND l2.family_name<>'' ORDER BY l2.created_at DESC LIMIT 1),'') AS name, l.event, l.device, l.country, l.created_at FROM support_login_log l)` + (where.length ? ' WHERE ' + where.join(' AND ') : '') + ` ORDER BY created_at DESC LIMIT ${limit}`;
  const stmt = env.DB.prepare(sql);
  const res = await (vals.length ? stmt.bind(...vals) : stmt).all();
  const sum = await env.DB.prepare(`SELECT COALESCE(SUM(event='login'),0) AS logins, COALESCE(SUM(event='return'),0) AS returns, COALESCE(SUM(event='failed'),0) AS failed, COUNT(DISTINCT CASE WHEN event IN ('login','return') THEN family_id END) AS families FROM support_login_log WHERE created_at>=?`).bind(since).first();
  const lastLogin = await env.DB.prepare(`SELECT MAX(created_at) AS t FROM support_login_log WHERE event IN ('login','return')`).first();
  return json({ ok: true, serverTime: now(), summary: { logins: Number(sum?.logins || 0), returns: Number(sum?.returns || 0), failed: Number(sum?.failed || 0), families: Number(sum?.families || 0), lastActivityAt: lastLogin?.t ? Number(lastLogin.t) : null },
    items: (res.results || []).map(r => ({ id: r.id, familyId: r.family_id, familyName: r.name || '', event: r.event, device: r.device || '', country: r.country || '', at: Number(r.created_at) })) });
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
    if(q.kind==='last4') return supportPhone(given).slice(-4)===q.answer;
    if(q.kind==='count') return supportPhone(given)===q.answer;
    return supportYear(given)===q.answer;
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
    await logSupportLogin(env,request,row.family_id,'failed');
    return json({ok:false,error},403);
  }
  await env.DB.prepare('DELETE FROM support_failures WHERE family_id=?').bind(row.family_id).run();
  const token=crypto.randomUUID()+crypto.randomUUID().replace(/-/g,''), t=now();
  await env.DB.prepare('INSERT INTO support_sessions(token,family_id,expires_at,created_at) VALUES(?,?,?,?)').bind(token,row.family_id,t+30*24*60*60*1000,t).run();
  await env.DB.prepare('DELETE FROM support_challenges WHERE challenge_id=?').bind(challengeId).run();
  let loginName=''; try { const lrows=await supportRowsForFamily(env,row.family_id); const lf=lrows.find(r=>supportNorm(r['صلة القرابة'])===supportNorm('رب الأسرة'))||lrows[0]||{}; loginName=String(lf['اسم رب الأسرة']||''); } catch(e) {}
  await logSupportLogin(env,request,row.family_id,'login',loginName);
  return json({ok:true,sessionToken:token,expiresInSeconds:30*24*60*60,message:'تم التحقق بنجاح.'});
}
async function supportSession(env, token) {
  if(!token) return null;
  const row=await env.DB.prepare('SELECT family_id,expires_at FROM support_sessions WHERE token=? LIMIT 1').bind(token).first();
  if(!row || Number(row.expires_at)<now()) { if(row) await env.DB.prepare('DELETE FROM support_sessions WHERE token=?').bind(token).run(); return null; }
  // Sliding 30-day expiry: refreshing the portal does not require a new identity check.
  const expiresAt=now()+30*24*60*60*1000;
  await env.DB.prepare('UPDATE support_sessions SET expires_at=? WHERE token=?').bind(expiresAt,token).run();
  return {...row,expires_at:expiresAt};
}
async function supportLogout(request, env) {
  await ensureSupportSchema(env);
  const token=cleanString(request.headers.get('X-Support-Session')||'',200);
  if(token) {
    try { const ls=await env.DB.prepare('SELECT family_id FROM support_sessions WHERE token=? LIMIT 1').bind(token).first(); if(ls) await logSupportLogin(env,request,ls.family_id,'logout'); } catch(e) {}
    await env.DB.prepare('DELETE FROM support_sessions WHERE token=?').bind(token).run();
  }
  return json({ok:true,message:'تم تسجيل الخروج وإنهاء الجلسة.'});
}

async function ensureAnnouncementsSchema(env){
 await ensureSchema(env);
 await env.DB.batch([
  env.DB.prepare(`CREATE TABLE IF NOT EXISTS camp_announcements (
   id TEXT PRIMARY KEY,title TEXT NOT NULL,body TEXT NOT NULL,category TEXT NOT NULL DEFAULT 'تعميم',
   priority TEXT NOT NULL DEFAULT 'عادي',status TEXT NOT NULL DEFAULT 'منشور',
   published_at INTEGER NOT NULL,expires_at INTEGER,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,author_device TEXT NOT NULL DEFAULT ''
  )`),
  env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_camp_announcements_public ON camp_announcements(status,published_at DESC,expires_at)`)
 ]);
}
function announcementDto(r){return {id:r.id,title:r.title,body:r.body,category:r.category,priority:r.priority,status:r.status,publishedAt:Number(r.published_at||0),expiresAt:r.expires_at==null?null:Number(r.expires_at),createdAt:Number(r.created_at||0),updatedAt:Number(r.updated_at||0)}}
async function listPublicAnnouncements(request,env){
 await ensureAnnouncementsSchema(env);const t=now();
 const r=await env.DB.prepare(`SELECT id,title,body,category,priority,status,published_at,expires_at,created_at,updated_at FROM camp_announcements WHERE status='منشور' AND published_at<=? AND (expires_at IS NULL OR expires_at>?) ORDER BY CASE priority WHEN 'عاجل' THEN 0 WHEN 'مهم' THEN 1 ELSE 2 END,published_at DESC LIMIT 50`).bind(t,t).all();
 return json({ok:true,items:(r.results||[]).map(announcementDto),serverTime:t});
}
async function listAdminAnnouncements(request,env){
 const auth=await requirePrimaryDevice(request,env);if(!auth.ok)return json({ok:false,error:auth.error,code:auth.code||'AUTH'},auth.code==='READ_ONLY'?403:401);
 await ensureAnnouncementsSchema(env);const r=await env.DB.prepare(`SELECT * FROM camp_announcements ORDER BY created_at DESC LIMIT 200`).all();return json({ok:true,items:(r.results||[]).map(announcementDto)});
}
async function saveAnnouncement(request,env){
 const auth=await requirePrimaryDevice(request,env);if(!auth.ok)return json({ok:false,error:auth.error,code:auth.code||'AUTH'},auth.code==='READ_ONLY'?403:401);
 await ensureAnnouncementsSchema(env);let b;try{b=await request.json()}catch{return json({ok:false,error:'البيانات المرسلة غير صالحة'},400)}
 const action=cleanString(b.action,20),id=cleanString(b.id,80),title=cleanString(b.title,160),body=cleanString(b.body,5000),category=cleanString(b.category||'تعميم',40),priority=cleanString(b.priority||'عادي',20),status=cleanString(b.status||'منشور',20);
 if(action==='delete'){if(!id)return json({ok:false,error:'معرّف الإعلان مطلوب'},400);const r=await env.DB.prepare(`DELETE FROM camp_announcements WHERE id=?`).bind(id).run();if(!r.meta?.changes)return json({ok:false,error:'الإعلان غير موجود'},404);return json({ok:true,deleted:true})}
 if(!['create','update'].includes(action))return json({ok:false,error:'الإجراء غير صحيح'},400);
 if(title.length<3||body.length<5)return json({ok:false,error:'أدخل عنوان الإعلان ونصاً واضحاً'},400);
 if(!['عادي','مهم','عاجل'].includes(priority)||!['منشور','مسودة','مؤرشف'].includes(status)||!['تعميم','تنويه','خدمات','تعليم','صحة','إغاثة'].includes(category))return json({ok:false,error:'الأولوية أو حالة النشر غير صحيحة'},400);
 const t=now(),pub=Number(b.publishedAt)||t,exp=b.expiresAt?Number(b.expiresAt):null;if(exp!==null&&(!Number.isFinite(exp)||exp<=pub))return json({ok:false,error:'تاريخ انتهاء الإعلان يجب أن يكون بعد تاريخ النشر'},400);
 if(action==='create'){const newId=crypto.randomUUID();await env.DB.prepare(`INSERT INTO camp_announcements(id,title,body,category,priority,status,published_at,expires_at,created_at,updated_at,author_device) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(newId,title,body,category,priority,status,pub,exp,t,t,auth.deviceId||'').run();return json({ok:true,id:newId},201)}
 if(!id)return json({ok:false,error:'معرّف الإعلان مطلوب'},400);
 const r=await env.DB.prepare(`UPDATE camp_announcements SET title=?,body=?,category=?,priority=?,status=?,published_at=?,expires_at=?,updated_at=? WHERE id=?`).bind(title,body,category,priority,status,pub,exp,t,id).run();if(!r.meta?.changes)return json({ok:false,error:'الإعلان غير موجود'},404);return json({ok:true,id});
}

async function supportNotifications(request, env) {
  await ensureSupportSchema(env);
  const token=cleanString(request.headers.get('X-Support-Session')||'',200);
  const session=await supportSession(env,token);
  if(!session) return json({ok:false,error:'انتهت جلسة الدخول. أعد التحقق من الهوية.'},401);
  const result=await env.DB.prepare(`SELECT ticket_no,request_type,subject,message,requested_changes,status,staff_reply,created_at,updated_at
    FROM support_requests WHERE family_id=? ORDER BY created_at DESC LIMIT 100`).bind(session.family_id).all();
  return json({ok:true,items:(result.results||[]).map(r=>({
    ticketNo:r.ticket_no,requestType:r.request_type,subject:r.subject,message:r.message,
    requestedChanges:r.requested_changes,status:r.status,staffReply:r.staff_reply,
    createdAt:Number(r.created_at),updatedAt:Number(r.updated_at)
  }))});
}

/* ===== واتساب العائلات: رقم واحد إلزامي لكل أسرة ===== */
async function ensureFamilyWhatsappSchema(env) {
  await ensureSupportSchema(env);
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS family_whatsapp (
    family_id TEXT PRIMARY KEY,
    family_name TEXT NOT NULL DEFAULT '',
    whatsapp_number TEXT NOT NULL,
    country_code TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_family_whatsapp_name ON family_whatsapp(family_name)`).run();
}
function normalizeWhatsappNumber(countryCode, localNumber) {
  const code = countryCode === '+972' ? '+972' : countryCode === '+970' ? '+970' : '';
  const digits = String(localNumber || '').replace(/[٠-٩۰-۹]/g, d => String('٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹'.indexOf(d) % 10)).replace(/\D/g, '');
  if (!code || digits.length < 7 || digits.length > 12) return null;
  return { code, number: code + digits };
}
async function supportSaveWhatsapp(request, env) {
  await ensureFamilyWhatsappSchema(env);
  const token = cleanString(request.headers.get('X-Support-Session') || '', 200);
  const session = await supportSession(env, token);
  if (!session) return json({ok:false,error:'انتهت جلسة التحقق. أعد التحقق من بيانات الأسرة.'},401);
  let body; try { body = await request.json(); } catch { return json({ok:false,error:'البيانات المرسلة غير صالحة'},400); }
  let parsed = normalizeWhatsappNumber(cleanString(body.countryCode,8), cleanString(body.phone,30));
  const supplied = String(body.whatsappNumber || '').replace(/[\s()-]/g,'');
  if (!parsed && /^\+97[02]\d{7,12}$/.test(supplied)) {
    parsed = { code: supplied.startsWith('+972') ? '+972' : '+970', number: supplied };
  }
  if (!parsed) return json({ok:false,error:'أدخل رقم واتساب صحيحًا مع اختيار رمز الدولة.'},400);
  const rows = await supportRowsForFamily(env, session.family_id);
  if (!rows.length) return json({ok:false,error:'تعذر العثور على بيانات الأسرة.'},404);
  const first = rows.find(r => supportNorm(r['صلة القرابة']) === supportNorm('رب الأسرة')) || rows[0];
  const familyName = cleanString(first['اسم رب الأسرة'] || '',200);
  await env.DB.prepare(`INSERT INTO family_whatsapp(family_id,family_name,whatsapp_number,country_code,updated_at)
    VALUES(?,?,?,?,?) ON CONFLICT(family_id) DO UPDATE SET
    family_name=excluded.family_name,whatsapp_number=excluded.whatsapp_number,
    country_code=excluded.country_code,updated_at=excluded.updated_at`)
    .bind(String(session.family_id),familyName,parsed.number,parsed.code,now()).run();
  return json({ok:true,whatsappNumber:parsed.number,message:'تم حفظ رقم واتساب الأسرة بنجاح.'});
}
async function listFamilyWhatsapp(request, env) {
  const auth = await requirePrimaryDevice(request, env);
  if (!auth.ok) return json({ok:false,error:auth.error,code:auth.code||'AUTH'},auth.code==='READ_ONLY'?403:401);
  await ensureFamilyWhatsappSchema(env);
  const records = await env.DB.prepare(`SELECT record_id,data_json FROM sync_records WHERE deleted=0 AND record_id LIKE 'r-%' ORDER BY record_id ASC LIMIT 10000`).all();
  const families = new Map();
  for (const item of (records.results || [])) {
    try {
      const row = JSON.parse(item.data_json || '{}');
      const familyId = supportNorm(row['رقم هوية الأسرة']);
      if (!familyId) continue;
      const old = families.get(familyId) || {familyId,name:''};
      if (!old.name || supportNorm(row['صلة القرابة']) === supportNorm('رب الأسرة')) old.name = cleanString(row['اسم رب الأسرة'] || old.name,200);
      families.set(familyId,old);
    } catch {}
  }
  const saved = await env.DB.prepare(`SELECT family_id,family_name,whatsapp_number,updated_at FROM family_whatsapp ORDER BY family_name COLLATE NOCASE`).all();
  const byId = new Map((saved.results||[]).map(x=>[String(x.family_id),x]));
  const items = [...families.values()].map(f=>{
    const w=byId.get(String(f.familyId));
    return {familyId:f.familyId,familyName:f.name||w?.family_name||'أسرة بدون اسم',whatsappNumber:w?.whatsapp_number||'',updatedAt:w?Number(w.updated_at):null};
  }).sort((a,b)=>a.familyName.localeCompare(b.familyName,'ar'));
  return json({ok:true,items,summary:{total:items.length,withWhatsapp:items.filter(x=>x.whatsappNumber).length,missing:items.filter(x=>!x.whatsappNumber).length}});
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
  await logSupportLogin(env,request,session.family_id,'return',familyName);
  const wa=await env.DB.prepare(`SELECT whatsapp_number FROM family_whatsapp WHERE family_id=? LIMIT 1`).bind(String(session.family_id)).first().catch(()=>null);
  return json({ok:true,family:{name:familyName,fields:supportPublicRecord(first),members:rows.map(supportPublicRecord),count:rows.length,whatsappNumber:wa?.whatsapp_number||''}});
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
  if(!['استفسار','شكوى','طلب تحديث بيانات','طلب مساعدة','طلب آخر'].includes(type)) return json({ok:false,error:'نوع الطلب غير صحيح'},400);
  if(familyName.length<3 || phone.length<8 || subject.length<3 || message.length<5) return json({ok:false,error:'يرجى استكمال عنوان الطلب وتفاصيله'},400);
  const incoming=Array.isArray(b.attachments)?b.attachments:[];
  if(incoming.length>3) return json({ok:false,error:'الحد الأقصى ثلاثة مرفقات للطلب الواحد'},400);
  const allowedTypes=new Set(['image/jpeg','image/png','image/webp','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
  const attachments=[];let totalBytes=0;
  for(const file of incoming){
    const name=cleanString(file?.name,180),mime=cleanString(file?.type,100),data=String(file?.data||''),size=Number(file?.size||0);
    if(!name||!allowedTypes.has(mime)||!Number.isInteger(size)||size<1||size>524288||!/^[A-Za-z0-9+/]*={0,2}$/.test(data)) return json({ok:false,error:'أحد المرفقات غير صالح أو يتجاوز 512 كيلوبايت'},400);
    const decoded=atob(data);if(decoded.length!==size) return json({ok:false,error:'تعذر التحقق من حجم أحد المرفقات'},400);
    totalBytes+=size;if(totalBytes>1572864)return json({ok:false,error:'إجمالي أحجام المرفقات يتجاوز 1.5 ميجابايت'},400);
    attachments.push({id:crypto.randomUUID(),name,mime,size,data});
  }
  const id=crypto.randomUUID(), t=now();
  // New requests use a simple six-digit code. The existing UNIQUE constraint
  // protects old and new ticket numbers without changing any stored records.
  let ticketNo='', saved=false;
  for(let attempt=0;attempt<12&&!saved;attempt++){
    const bytes=new Uint32Array(1); crypto.getRandomValues(bytes);
    ticketNo=String(100000+(bytes[0]%900000));
    const exists=await env.DB.prepare(`SELECT 1 AS found FROM support_requests WHERE ticket_no=? LIMIT 1`).bind(ticketNo).first();
    if(exists) continue;
    try{
      const statements=[env.DB.prepare(`INSERT INTO support_requests(id,ticket_no,request_type,family_name,family_id,phone,subject,message,requested_changes,status,staff_reply,created_at,updated_at,device_hint) VALUES(?,?,?,?,?,?,?,?,?,'جديد','',?,?,?)`)
        .bind(id,ticketNo,type,familyName,familyId,phone,subject,message,changes,t,t,cleanString(request.headers.get('X-Device-Id'),120))];
      for(const f of attachments) statements.push(env.DB.prepare(`INSERT INTO support_attachments(id,ticket_no,file_name,content_type,file_size,data_base64,created_at) VALUES(?,?,?,?,?,?,?)`).bind(f.id,ticketNo,f.name,f.mime,f.size,f.data,t));
      await env.DB.batch(statements);saved=true;
    }catch(err){
      // A simultaneous request may claim the same six-digit number; retry only
      // if that code now exists, otherwise propagate the actual database error.
      const collision=await env.DB.prepare(`SELECT 1 AS found FROM support_requests WHERE ticket_no=? LIMIT 1`).bind(ticketNo).first();
      if(!collision) throw err;
    }
  }
  if(!saved) return json({ok:false,error:'تعذر إنشاء رقم متابعة الآن. يرجى المحاولة مرة أخرى.'},503);
  return json({ok:true,ticketNo,status:'قيد المتابعة',attachmentCount:attachments.length,message:'تم استلام طلبك وحفظه لدى إدارة المخيم. احتفظ برقم المتابعة المكوّن من 6 أرقام.'},201);
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
  const rows=res.results||[], tickets=rows.map(r=>r.ticket_no);let attachmentMap={};
  if(tickets.length){const marks=tickets.map(()=>'?').join(',');const ar=await env.DB.prepare(`SELECT id,ticket_no,file_name,content_type,file_size FROM support_attachments WHERE ticket_no IN (${marks}) ORDER BY created_at ASC`).bind(...tickets).all();for(const f of (ar.results||[])){(attachmentMap[f.ticket_no] ||= []).push({id:f.id,name:f.file_name,type:f.content_type,size:Number(f.file_size)})}}
  return json({ok:true,items:rows.map(r=>({id:r.id,ticketNo:r.ticket_no,requestType:r.request_type,familyName:r.family_name,familyId:r.family_id,phone:r.phone,subject:r.subject,message:r.message,requestedChanges:r.requested_changes,status:r.status,staffReply:r.staff_reply,attachments:attachmentMap[r.ticket_no]||[],createdAt:Number(r.created_at),updatedAt:Number(r.updated_at)}))});
}
async function supportAttachment(request,env){
 const auth=await requirePrimaryDevice(request,env);if(!auth.ok)return json({ok:false,error:auth.error,code:auth.code||'AUTH'},auth.code==='READ_ONLY'?403:401);
 await ensureSupportSchema(env);const id=cleanString(new URL(request.url).searchParams.get('id'),80);if(!id)return json({ok:false,error:'معرّف المرفق مطلوب'},400);
 const f=await env.DB.prepare(`SELECT id,ticket_no,file_name,content_type,file_size,data_base64 FROM support_attachments WHERE id=? LIMIT 1`).bind(id).first();
 if(!f)return json({ok:false,error:'المرفق غير موجود'},404);
 return json({ok:true,attachment:{id:f.id,ticketNo:f.ticket_no,name:f.file_name,type:f.content_type,size:Number(f.file_size),data:f.data_base64}});
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
      if (url.pathname === "/announcements" && request.method === "GET") return await listPublicAnnouncements(request, env);
      if (url.pathname === "/announcements/admin" && request.method === "GET") return await listAdminAnnouncements(request, env);
      if (url.pathname === "/announcements/admin" && request.method === "POST") return await saveAnnouncement(request, env);
      if (url.pathname === "/support/challenge" && request.method === "POST") return await supportChallenge(request, env);
      if (url.pathname === "/support/verify" && request.method === "POST") return await supportVerify(request, env);
      if (url.pathname === "/support/contact" && request.method === "POST") return await supportSaveWhatsapp(request, env);
      if (url.pathname === "/support/whatsapp/admin" && request.method === "GET") return await listFamilyWhatsapp(request, env);
      if (url.pathname === "/support/lookup" && request.method === "POST") return await supportLookup(request, env);
      if (url.pathname === "/support/submit" && request.method === "POST") return await supportSubmit(request, env);
      if (url.pathname === "/support/notifications" && request.method === "GET") return await supportNotifications(request, env);
      if (url.pathname === "/support/logout" && request.method === "POST") return await supportLogout(request, env);
      if (url.pathname === "/support/status" && request.method === "POST") return await supportStatus(request, env);
      if (url.pathname === "/support/list" && request.method === "GET") return await supportList(request, env);
      if (url.pathname === "/support/update" && request.method === "POST") return await supportUpdate(request, env);
      if (url.pathname === "/support/attachment" && request.method === "GET") return await supportAttachment(request, env);
      if (url.pathname === "/support/logins" && request.method === "GET") return await supportLogins(request, env);
      if (url.pathname === "/health") return await health(env);
      if (url.pathname === "/auth/display-login" && request.method === "POST") return await displayLogin(request, env);
      if (url.pathname === "/auth/display-validate" && request.method === "GET") return await displayValidate(request, env);
      if (url.pathname === "/auth/admin-setup" && request.method === "POST") return await adminSetup(request, env);
      if (url.pathname === "/auth/admin-password" && request.method === "POST") return await adminChangePassword(request, env);
      if (url.pathname === "/auth/logout" && request.method === "POST") return await authLogout(request, env);
      if (url.pathname === "/auth/display-accounts" && request.method === "GET") return await listDisplayAccounts(request, env);
      if (url.pathname === "/auth/display-accounts" && request.method === "POST") return await createDisplayAccount(request, env);
      if (url.pathname === "/auth/display-account" && request.method === "POST") return await setDisplayAccount(request, env);
      if (url.pathname === "/auth/display-revoke-session" && request.method === "POST") return await revokeDisplaySession(request, env);
      if (url.pathname === "/auth/display-permissions" && request.method === "POST") return await setDisplayPermissions(request, env);
      if (url.pathname === "/auth/display-emergency-lock" && request.method === "POST") return await setDisplayEmergencyLock(request, env);
      if (url.pathname === "/auth/display-activity" && request.method === "GET") return await listDisplayActivity(request, env);
      if (url.pathname === "/sync/admin/recovery/inspect" && request.method === "POST") return await recoveryInspect(request, env);
      if (url.pathname === "/sync/admin/recovery/deleted" && request.method === "GET") return await recoveryDeletedList(request, env);
      if (url.pathname === "/sync/role" && request.method === "GET") return await role(request, env);
      if (url.pathname === "/sync/pulse" && request.method === "GET") return await syncPulse(request, env);
      if (url.pathname === "/sync/claim-primary" && request.method === "POST") return await claimPrimary(request, env);
      if (url.pathname === "/sync/pull" && request.method === "GET") return await pull(request, env);
      if (url.pathname === "/sync/push" && request.method === "POST") return await push(request, env);
      if (url.pathname === "/sync/primary-reconcile" && request.method === "POST") return await primaryReconcile(request, env);
      if (url.pathname === "/sync/admin/refresh-authoritative-meta" && request.method === "POST") return await refreshAuthoritativeMeta(request, env);
      if (url.pathname === "/sync/authoritative" && request.method === "GET") return await authoritativeSnapshot(request, env);
      if (url.pathname === "/sync/bootstrap" && request.method === "POST") return await bootstrap(request, env);
      if (env.ASSETS) return await env.ASSETS.fetch(request);
      return json({ ok: false, error: "واجهة التطبيق غير مفعلة: اربط Static Assets" }, 404);
    } catch (e) {
      return json({ ok: false, error: "خطأ داخلي", detail: String(e?.message || e) }, 500);
    }
  }
};
