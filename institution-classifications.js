const decode = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
async function authorized(request, env) {
  const issuer = env.ACCESS_ISSUER;
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer) || !env.ACCESS_AUD) return false;
  const token = request.headers.get('Cf-Access-Jwt-Assertion') || '';
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const [header, claims] = parts.slice(0, 2).map(p => JSON.parse(new TextDecoder().decode(decode(p))));
    const now = Date.now() / 1000;
    if (header.alg !== 'RS256' || claims.iss !== issuer || !Array.isArray(claims.aud) ||
        !claims.aud.includes(env.ACCESS_AUD) || !Number.isFinite(claims.exp) || claims.exp <= now ||
        claims.nbf > now || !claims.email) return false;
    const response = await fetch(issuer + '/cdn-cgi/access/certs', {cf:{cacheTtl:300,cacheEverything:true}});
    if (!response.ok) return false;
    const {keys} = await response.json();
    const jwk = keys.find(k => k.kid === header.kid && k.kty === 'RSA');
    if (!jwk) return false;
    const key = await crypto.subtle.importKey('jwk', jwk, {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'}, false, ['verify']);
    return crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decode(parts[2]), new TextEncoder().encode(parts.slice(0,2).join('.')));
  } catch { return false; }
}
const sql = `WITH raw AS (
 SELECT CASE WHEN json_valid(data_json) THEN json_extract(data_json,'$."رقم هوية الفرد"') END AS ident,
 CASE WHEN json_valid(data_json) THEN json_extract(data_json,'$."تاريخ الميلاد"') END AS dob
 FROM sync_records WHERE deleted=0 AND record_id GLOB 'r-*'
), normalized AS (
 SELECT trim(CAST(ident AS TEXT)) AS id,trim(dob) AS born FROM raw
), persons AS (
 SELECT id,min(born) AS born,
 max(CASE WHEN id IS NULL OR length(id)<>9 OR id GLOB '*[^0-9]*' OR born IS NULL
 OR born NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' OR
 date(born,'+0 days') IS NOT born OR born>?1 THEN 1 ELSE 0 END) AS invalid,
 count(DISTINCT born) AS variants FROM normalized GROUP BY id
), ages AS (
 SELECT cast(substr(?1,1,4) AS integer)-cast(substr(born,1,4) AS integer)
 -(substr(?1,6)<substr(born,6)) AS age,invalid,variants FROM persons
) SELECT count(*) AS total, sum(invalid OR variants<>1) AS errors,
 sum(age<5) AS a,sum(age BETWEEN 5 AND 12) AS b,sum(age BETWEEN 13 AND 17) AS c,
 sum(age BETWEEN 18 AND 59) AS d,sum(age>=60) AS e FROM ages`;
const groups = {adult:'18 سنة فأكثر',child:'أقل من 18 سنة',school:'من 5 إلى 12 سنة',older:'60 سنة فأكثر'};
const snapshots = new WeakMap();
async function totals(db, day) {
  const current = snapshots.get(db);
  if (current?.day === day && Date.now() < current.expires) return current.value;
  const value = db.prepare(sql).bind(day).first();
  snapshots.set(db,{day,expires:Date.now()+300000,value});
  try {return await value;} catch (err) {if (snapshots.get(db)?.value === value) snapshots.delete(db);throw err;}
}
export async function institutionClassifications(request,env) {
 const headers = {'Content-Type':'text/html;charset=utf-8','Cache-Control':'private, no-store','X-Robots-Tag':'noindex','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"};
 const send=(content,status=200)=>new Response('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>التصنيفات المتقدمة | مخيم أبو عريبان</title><style>*{box-sizing:border-box}body{font:18px/1.7 system-ui;background:#eef3f2;color:#19394a;padding:1rem}main{max-width:38rem;margin:6vh auto;background:white;padding:clamp(1rem,5vw,3rem);border-radius:1rem}select,button{font:inherit;padding:.45rem;margin:.4rem 0;border-radius:.4rem}button{background:#195d51;color:white}output{font-size:2rem;font-weight:bold}</style><main><small>مخيم أبو عريبان للنازحين</small><h1>التصنيفات المتقدمة</h1>'+content+'</main></html>',{status,headers});
 if(request.method!=='GET') return send('طريقة الطلب غير مدعومة.',405);
 if(!await authorized(request,env)) return send('يلزم الدخول بحساب المؤسسة المعتمد.',403);
 const key=new URL(request.url).searchParams.get('group')||'';
 if(key && !Object.hasOwn(groups,key))return send('التصنيف غير معروف.',400);
 const form='<form><label>اختر التصنيف <select name="group">'+Object.entries(groups).map(([id,label])=>'<option value="'+id+'" '+(key===id?'selected':'')+'>'+label+'</option>').join('')+'</select></label> <button>عرض العدد</button></form>';
 if(!key)return send(form);
 try {
   const min=Number(env.MIN_CELL);
   if(!Number.isSafeInteger(min)||min<2) return send(form+'النتيجة غير متاحة حالياً.',503);
   const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Gaza',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
   const r=await totals(env.DB,day);
   if(!r?.total || r.errors || ![r.a,r.b,r.c,r.d,r.e].every(Number.isSafeInteger))return send(form+'النتيجة غير متاحة حتى مراجعة بيانات المصدر.',503);
   if([r.a,r.b,r.c,r.d,r.e].some(n=>n<min))return send(form+'العدد محجوب لحماية الخصوصية.');
   const count={adult:r.d+r.e,child:r.a+r.b+r.c,school:r.b,older:r.e}[key];
   return send(form+'<output>'+count+' فرد</output><p>جميع الأفراد المسجلين · تاريخ احتساب العمر '+day+' بتوقيت غزة</p>');
 }catch{return send(form+'النتيجة غير متاحة حالياً.',503);}
}

// Publish only the two explicitly enabled, camp-wide totals.
const overviewCache = new WeakMap();
export async function publicOverview(request,env) {
 const headers={'Cache-Control':'no-store','Access-Control-Allow-Origin':'*','X-Robots-Tag':'noindex'};
 const respond=(value,status)=>Response.json(value,{status,headers});
 const min=Number(env.MIN_CELL);
 if(request.method!=='GET')return respond({},405);
 const includeAge=env.PUBLIC_TOTALS_ENABLED==='overview-and-age';
 if((env.PUBLIC_TOTALS_ENABLED!=='true'&&!includeAge)||!Number.isSafeInteger(min)||min<2)return respond({},503);
 try {
   let entry=overviewCache.get(env.DB);
   if(!entry || entry.expires<=Date.now()){
     const asOf=new Date().toISOString();
     const pending=env.DB.prepare(`WITH ids AS (
       SELECT CASE WHEN json_valid(data_json) THEN trim(json_extract(data_json,'$."رقم هوية الفرد"')) END AS p,
              CASE WHEN json_valid(data_json) THEN trim(json_extract(data_json,'$."رقم هوية الأسرة"')) END AS f
       FROM sync_records WHERE deleted=0 AND record_id GLOB 'r-*'
     ), members AS (
       SELECT p,min(f) AS family,count(DISTINCT f) AS families,
       max(p IS NULL OR length(p)<>9 OR p GLOB '*[^0-9]*' OR f IS NULL OR length(f)<>9 OR f GLOB '*[^0-9]*') AS invalid
       FROM ids GROUP BY p
     ) SELECT count(*) AS people,count(DISTINCT family) AS households,
       coalesce(sum(invalid OR families<>1),0) AS errors FROM members`).first();
     entry={pending,asOf,expires:Date.now()+300000};
     overviewCache.set(env.DB,entry);
   }
   const row=await entry.pending;
   if(!row||row.errors||![row.people,row.households].every(n=>Number.isSafeInteger(n)&&n>=min))return respond({},503);
   const result={people:row.people,households:row.households,asOf:entry.asOf};
   if(includeAge){
     const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Gaza',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
     const ages=await totals(env.DB,day);
     if(ages && !ages.errors && ages.total===row.people && [ages.a,ages.b,ages.c,ages.d,ages.e].every(n=>Number.isSafeInteger(n)&&n>=min)){
       result.age={adult:ages.d+ages.e,child:ages.a+ages.b+ages.c,school:ages.b,older:ages.e};
       result.ageDay=day;
     }
   }
   return respond(result,200);
 }catch{return respond({},503);}
}
