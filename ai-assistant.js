// Abu Oreiban AI — server-side, disabled by default.
// No family personal records are passed to the model.
const HEADERS = {'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'Content-Type,X-Support-Session'};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:HEADERS});
export async function handleAiChat(request,env){
  if(request.method!=='POST') return reply({ok:false,error:'الطريقة غير مدعومة'},405);
  if(env.AI_ENABLED!=='true') return reply({ok:false,error:'المساعد الذكي غير مفعّل حالياً',code:'AI_DISABLED'},503);
  if(!env.AI || !env.DB) return reply({ok:false,error:'إعدادات الذكاء الاصطناعي غير مكتملة'},503);
  const token=(request.headers.get('X-Support-Session')||'').trim();
  if(!token || token.length>200) return reply({ok:false,error:'يرجى تسجيل الدخول أولاً'},401);
  const session=await env.DB.prepare('SELECT family_id FROM support_sessions WHERE token=? AND expires_at>? LIMIT 1').bind(token,Date.now()).first();
  if(!session) return reply({ok:false,error:'انتهت جلسة الدخول'},401);
  let body;try{body=await request.json()}catch{return reply({ok:false,error:'طلب غير صالح'},400)}
  const message=typeof body?.message==='string'?body.message.trim():'';
  if(!message || message.length>1200) return reply({ok:false,error:'اكتب رسالة من 1 إلى 1200 حرف'},400);
  // Fixed safety policy: knowledge and account tools will be added in later phases.
  const system=`أنت مساعد ذكاء اصطناعي لإدارة مخيم أبو عريبان. تحدث بالعربية الفلسطينية بأسلوب مهذب وواضح. لا تخترع إعلانات أو مواعيد أو توزيعات أو حالة دفع أو حالة طلب. لا تزعم الوصول إلى بيانات الأسرة أو الأنظمة. إذا احتاج السؤال معلومة داخلية غير متاحة لك، وضح أنك لا تستطيع التحقق منها الآن ووجّه المستخدم إلى الدعم الفني. لا تطلب أرقام هويات أو معلومات طبية. لا تعد بالمساعدات ولا تربط استحقاق الإغاثة بالمساهمة المالية. لا تنفذ أي إجراء إداري أو مالي.`;
  try{
    const result=await env.AI.run(env.AI_MODEL||'@cf/meta/llama-3.1-8b-instruct',{messages:[{role:'system',content:system},{role:'user',content:message}],max_tokens:350,temperature:0.3});
    const answer=String(result?.response||'').trim();
    if(!answer) throw new Error('empty model response');
    return reply({ok:true,reply:answer,mode:'informational',actions:[]});
  }catch(e){console.error('AI inference failed',String(e));return reply({ok:false,error:'تعذّر تشغيل المساعد حالياً، يمكنك استخدام الدعم الفني المعتاد',code:'AI_UNAVAILABLE'},503)}
}
