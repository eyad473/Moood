// Abu Oreiban AI — Gemini backend. Informational only.
// Do not send family records, session tokens, or database data to Gemini.
const HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST,OPTIONS',
  'access-control-allow-headers': 'Content-Type,X-Support-Session'
};
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: HEADERS });
const fail = (status, code, error) => reply({ ok: false, code, error }, status);
const SYSTEM = `أنت مساعد ذكاء اصطناعي لإدارة مخيم أبو عريبان. تحدث بالعربية الفلسطينية بأسلوب مهذب وواضح. لا تخترع إعلانات أو مواعيد أو توزيعات أو حالة دفع أو حالة طلب. لا تزعم الوصول إلى بيانات الأسرة أو الأنظمة. إذا احتاج السؤال معلومة داخلية غير متاحة لك، وضح أنك لا تستطيع التحقق منها الآن ووجّه المستخدم إلى الدعم الفني. لا تطلب أرقام هويات أو معلومات طبية. لا تعد بالمساعدات ولا تربط استحقاق الإغاثة بالمساهمة المالية. لا تنفذ أي إجراء إداري أو مالي.`;

export async function handleAiChat(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS });
  if (request.method !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED', 'الطريقة غير مدعومة');
  if (env.AI_ENABLED !== 'true') return fail(503, 'AI_DISABLED', 'المساعد الذكي غير مفعّل حالياً');
  if (!env.DB) return fail(503, 'DB_BINDING_MISSING', 'خدمة التحقق من الجلسات غير متوفرة حالياً');
  if (!env.GEMINI_API_KEY) return fail(503, 'GEMINI_KEY_MISSING', 'مفتاح خدمة المساعد غير مُعدّ على الخادم');

  const token = (request.headers.get('X-Support-Session') || '').trim();
  if (!token || token.length > 200) return fail(401, 'SESSION_REQUIRED', 'يرجى تسجيل الدخول أولاً');
  let session;
  try {
    session = await env.DB.prepare('SELECT family_id FROM support_sessions WHERE token=? AND expires_at>? LIMIT 1')
      .bind(token, Date.now()).first();
  } catch (e) {
    console.error('Gemini session validation failed', e?.name || 'DatabaseError');
    return fail(503, 'AI_SESSION_DB_ERROR', 'تعذّر التحقق من جلسة الدخول حالياً');
  }
  if (!session) return fail(401, 'SESSION_EXPIRED', 'انتهت جلسة الدخول');

  let body;
  try { body = await request.json(); }
  catch { return fail(400, 'INVALID_JSON', 'طلب غير صالح'); }
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  if (!message || message.length > 1200) return fail(400, 'INVALID_MESSAGE', 'اكتب رسالة من 1 إلى 1200 حرف');

  const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
  if (!/^[a-zA-Z0-9._-]+$/.test(model)) return fail(503, 'GEMINI_MODEL_INVALID', 'اسم نموذج المساعد غير صالح');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  let response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: message }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 700 }
      }),
      signal: controller.signal
    });
  } catch (e) {
    console.error('Gemini transport error', e?.name || 'NetworkError');
    return fail(503, e?.name === 'AbortError' ? 'GEMINI_TIMEOUT' : 'GEMINI_NETWORK_ERROR', 'تعذّر الاتصال بخدمة المساعد حالياً');
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    // Never log the API key, provider response body, or resident message.
    console.error('Gemini HTTP error', response.status);
    if (response.status === 429) return fail(503, 'GEMINI_RATE_LIMIT', 'خدمة المساعد مشغولة حالياً، يُرجى المحاولة لاحقاً');
    if (response.status === 401 || response.status === 403) return fail(503, 'GEMINI_AUTH_ERROR', 'تعذّر التحقق من إعدادات خدمة المساعد');
    if (response.status === 404) return fail(503, 'GEMINI_MODEL_NOT_FOUND', 'نموذج المساعد غير متاح حالياً');
    return fail(503, 'GEMINI_PROVIDER_ERROR', 'تعذّر تشغيل خدمة المساعد حالياً');
  }
  let data;
  try { data = await response.json(); }
  catch { return fail(503, 'GEMINI_INVALID_RESPONSE', 'وصل رد غير صالح من خدمة المساعد'); }
  const answer = (data?.candidates?.[0]?.content?.parts || [])
    .filter(part => typeof part?.text === 'string' && !part.thought)
    .map(part => part.text).join('\n').trim();
  if (!answer) return fail(503, 'GEMINI_EMPTY_RESPONSE', 'لم يُرجع المساعد إجابة، يُرجى المحاولة لاحقاً');
  return reply({ ok: true, reply: answer, mode: 'informational', actions: [] });
}
