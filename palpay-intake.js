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
