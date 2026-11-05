// Abu Oreiban AI — informational assistant only.
// Never send family records, session tokens or database data to the model.
const HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST,OPTIONS',
  'access-control-allow-headers': 'Content-Type,X-Support-Session'
};
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: HEADERS });
const fail = (status, code, error) => reply({ ok: false, code, error }, status);

export async function handleAiChat(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS });
  if (request.method !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED', 'الطريقة غير مدعومة');
  if (env.AI_ENABLED !== 'true') return fail(503, 'AI_DISABLED', 'المساعد الذكي غير مفعّل حالياً');
  if (!env.AI) return fail(503, 'AI_BINDING_MISSING', 'ربط خدمة الذكاء الاصطناعي غير متوفر على الخادم');
  if (!env.DB) return fail(503, 'DB_BINDING_MISSING', 'خدمة التحقق من الجلسات غير متوفرة حالياً');

  const token = (request.headers.get('X-Support-Session') || '').trim();
  if (!token || token.length > 200) return fail(401, 'SESSION_REQUIRED', 'يرجى تسجيل الدخول أولاً');

  let session;
  try {
    session = await env.DB.prepare(
      'SELECT family_id FROM support_sessions WHERE token=? AND expires_at>? LIMIT 1'
    ).bind(token, Date.now()).first();
  } catch (e) {
    console.error('AI session validation failed', e?.name || 'DatabaseError');
    return fail(503, 'AI_SESSION_DB_ERROR', 'تعذّر التحقق من جلسة الدخول حالياً');
  }
  if (!session) return fail(401, 'SESSION_EXPIRED', 'انتهت جلسة الدخول');

  let body;
  try { body = await request.json(); }
  catch { return fail(400, 'INVALID_JSON', 'طلب غير صالح'); }
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  if (!message || message.length > 1200) return fail(400, 'INVALID_MESSAGE', 'اكتب رسالة من 1 إلى 1200 حرف');

  const system = `أنت مساعد ذكاء اصطناعي لإدارة مخيم أبو عريبان. تحدث بالعربية الفلسطينية بأسلوب مهذب وواضح. لا تخترع إعلانات أو مواعيد أو توزيعات أو حالة دفع أو حالة طلب. لا تزعم الوصول إلى بيانات الأسرة أو الأنظمة. إذا احتاج السؤال معلومة داخلية غير متاحة لك، وضح أنك لا تستطيع التحقق منها الآن ووجّه المستخدم إلى الدعم الفني. لا تطلب أرقام هويات أو معلومات طبية. لا تعد بالمساعدات ولا تربط استحقاق الإغاثة بالمساهمة المالية. لا تنفذ أي إجراء إداري أو مالي.`;

  let result;
  try {
    result = await env.AI.run(env.AI_MODEL || '@cf/meta/llama-3.1-8b-instruct', {
      messages: [{ role: 'system', content: system }, { role: 'user', content: message }],
      max_tokens: 350,
      temperature: 0.3
    });
  } catch (e) {
    // Log details only server-side; do not expose provider errors or user input to residents.
    console.error('AI inference failed', e?.name || 'AIError', String(e?.message || '').slice(0, 300));
    return fail(503, 'AI_INFERENCE_FAILED', 'تعذّر تشغيل نموذج الذكاء الاصطناعي حالياً. يُرجى استخدام الدعم الفني المعتاد');
  }

  const answer = typeof result?.response === 'string' ? result.response.trim() : '';
  if (!answer) {
    console.error('AI inference returned empty response');
    return fail(503, 'AI_EMPTY_RESPONSE', 'لم يُرجع المساعد إجابة. يُرجى المحاولة لاحقاً');
  }
  return reply({ ok: true, reply: answer, mode: 'informational', actions: [] });
}
