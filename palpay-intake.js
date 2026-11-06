// PalPay phase 1: authenticated notification intake, staging only. No payment is marked paid here.
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*'}});
const enc=new TextEncoder();
function equal(a,b){if(a.length!==b.length)return false;let v=0;for(let i=0;i<a.length;i++)v|=a[i]^b[i];return v===0}
async function authorized(request,env){
 const expected=env.PALPAY_INGEST_TOKEN;
 const actual=request.headers.get('X-PalPay-Token')||'';
 if(!expected||!actual)return false;
 const [a,b]=await Promise.all([crypto.subtle.digest('SHA-256',enc.encode(actual)),crypto.subtle.digest('SHA-256',enc.encode(expected))]);
 return equal(new Uint8Array(a),new Uint8Array(b));
}
async function schema(env){
 await env.DB.prepare(`CREATE TABLE IF NOT EXISTS palpay_notification_inbox (id INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT NOT NULL UNIQUE, sender_name TEXT NOT NULL, amount_agorot INTEGER NOT NULL, currency TEXT NOT NULL, direction TEXT NOT NULL, notification_time INTEGER NOT NULL, received_at INTEGER NOT NULL, source TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending_review', note TEXT NOT NULL DEFAULT '')`).run();
 await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_palpay_inbox_status ON palpay_notification_inbox(status,received_at)`).run();
}
export async function palpayIngest(request,env){
 if(!await authorized(request,env))return reply({ok:false,error:'غير مصرح'},401);
 if(Number(request.headers.get('content-length')||0)>8192)return reply({ok:false,error:'حجم الطلب كبير'},413);
 let b;try{b=await request.json()}catch{return reply({ok:false,error:'صيغة غير صالحة'},400)}
 const eventId=String(b.eventId||'').trim(), sender=String(b.senderName||'').trim();
 const amount=Number(b.amountAgorot),time=Number(b.notificationTime);
 const currency=String(b.currency||'').toUpperCase(),direction=String(b.direction||'').toLowerCase();
 if(!/^[a-zA-Z0-9:_-]{12,128}$/.test(eventId)||sender.length<3||sender.length>120||!Number.isSafeInteger(amount)||amount<1||amount>10000000||currency!=='ILS'||!['incoming','unknown'].includes(direction)||!Number.isSafeInteger(time)||Math.abs(Date.now()-time)>30*86400000)return reply({ok:false,error:'بيانات العملية غير صالحة'},400);
 await schema(env);
 const result=await env.DB.prepare(`INSERT OR IGNORE INTO palpay_notification_inbox(event_id,sender_name,amount_agorot,currency,direction,notification_time,received_at,source,status) VALUES(?,?,?,?,?,?,?,?,?)`).bind(eventId,sender,amount,currency,direction,time,Date.now(),'android_notification','pending_review').run();
 return reply({ok:true,accepted:!!result.meta?.changes,duplicate:!result.meta?.changes,status:'pending_review'});
}
export async function palpayInbox(request,env,adminCheck){
 const auth=await adminCheck(request,env);if(auth.error)return auth.error;
 await schema(env);
 const rows=await env.DB.prepare(`SELECT id,event_id,sender_name,amount_agorot,currency,direction,notification_time,received_at,status FROM palpay_notification_inbox ORDER BY received_at DESC LIMIT 100`).all();
 return reply({ok:true,notifications:rows.results||[]});
}


// Phase 3: read-only, admin-only candidate matching. Does NOT record a payment.
function normalizeArabicName(value) {
 return String(value||'').normalize('NFKC').toLowerCase()
  .replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[إأآٱ]/g,'ا')
  .replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[ؤ]/g,'و').replace(/[ئ]/g,'ي')
  .replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
}
function matchScore(sender,head) {
 const a=normalizeArabicName(sender),b=normalizeArabicName(head);
 if(!a||!b)return 0;
 if(a===b)return 100;
 const x=a.split(' ').filter(Boolean),y=b.split(' ').filter(Boolean);
 const shared=x.filter(t=>y.includes(t));
 if(!shared.length)return 0;
 const overlap=shared.length/Math.max(x.length,y.length);
 const prefix=x[0]===y[0]?12:0;
 const family=x[x.length-1]===y[y.length-1]?12:0;
 return Math.min(95,Math.round(overlap*70+prefix+family));
}
export async function palpayCandidates(request,env,adminCheck){
 const auth=await adminCheck(request,env);if(auth.error)return auth.error;
 const url=new URL(request.url),id=Number(url.searchParams.get('id'));
 if(!Number.isSafeInteger(id)||id<1)return reply({ok:false,error:'رقم الإشعار غير صالح'},400);
 await schema(env);
 const event=await env.DB.prepare(`SELECT id,event_id,sender_name,amount_agorot,currency,direction,status,notification_time FROM palpay_notification_inbox WHERE id=?`).bind(id).first();
 if(!event)return reply({ok:false,error:'الإشعار غير موجود'},404);
 const records=await env.DB.prepare(`SELECT data_json FROM sync_records WHERE deleted=0 AND record_id LIKE 'r-%' AND json_valid(data_json) AND json_extract(data_json, '$."اسم رب الأسرة"') IS NOT NULL`).all();
 const unique=new Map();
 for(const row of records.results||[]){
  let d;try{d=JSON.parse(row.data_json)}catch{continue}
  const familyId=String(d['رقم هوية الأسرة']||'').trim(),familyName=String(d['اسم رب الأسرة']||'').trim();
  if(!/^\d{9}$/.test(familyId)||!familyName)continue;
  if(unique.has(familyId))continue;
  const score=matchScore(event.sender_name,familyName);
  if(score>=40)unique.set(familyId,{familyId,familyName,score});
 }
 const candidates=[...unique.values()].sort((a,b)=>b.score-a.score||a.familyName.localeCompare(b.familyName,'ar')).slice(0,10);
 return reply({ok:true,notification:{id:event.id,senderName:event.sender_name,amountAgorot:event.amount_agorot,currency:event.currency,direction:event.direction,status:event.status,notificationTime:event.notification_time},candidates,requiresVerification:true,automaticPayment:false,note:'اقتراحات فقط؛ لا يُثبت الدفع من الإشعار أو تشابه الاسم وحده. قد تظهر إشعارات متعددة لنفس العملية.'});
}
