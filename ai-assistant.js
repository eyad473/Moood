// Abu Oreiban AI — Gemini primary, Groq fallback, Workers AI final fallback. Informational only.
// Never send resident records, session tokens or database data to an AI provider.
const HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST,OPTIONS',
  'access-control-allow-headers': 'Content-Type,X-Support-Session'
};
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: HEADERS });
const fail = (status, code, error) => reply({ ok: false, code, error }, status);
const SYSTEM = `أنت المساعد الرسمي داخل بوابة أهالي مخيم أبو عريبان. تكلم بالعربية الفلسطينية بأدب ووضوح. لا تخترع مطلقاً أرقام هاتف أو بريد إلكتروني أو روابط أو مواعيد توزيع أو قرارات أو بيانات أسر أو حالات طلبات. لا تقل للمواطن أن يتواصل مع support@portal.com أو رقم 12345 أو أي جهة اتصال غير موثقة. عند الحديث عن شكوى أو طلب، أخبره أنه يستطيع شرح المشكلة هنا ليتم تسجيل الشكاوى الروتينية عبر نظام المخيم، ولا تدّع أن شكوى سُجلت أو أُرسلت إلا إذا أكد النظام ذلك برقم متابعة فعلي. لا تَعِد بتوزيع مساعدات أو باستحقاقها. لا تطلب أرقام الهوية أو كلمات المرور أو معلومات صحية حساسة. لا تغيّر بيانات الأسر أو تؤكد دفعاً مالياً أو تتخذ قرارات إدارية. إذا لم تعرف معلومة، قل بوضوح إنها غير متاحة لديك.`;
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const safeModel = value => typeof value === 'string' && /^[A-Za-z0-9._-]+$/.test(value);
const geminiAnswer = data => (data?.candidates?.[0]?.content?.parts || [])
  .filter(part => typeof part?.text === 'string' && !part.thought)
  .map(part => part.text).join('\n').trim();

async function timedFetch(url, options, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

async function callGemini(env, message, model) {
  const response = await timedFetch(`${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: message }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 350 }
    })
  }, 12000);
  if (!response.ok) {
    const error = new Error('Gemini HTTP status');
    error.status = response.status;
    throw error;
  }
  const data = await response.json();
  const answer = geminiAnswer(data);
  if (!answer) throw new Error('Gemini empty response');
  return answer;
}

// Only invoked after a 404: verify which text-generation models the API key can access.
async function discoverGeminiModel(env) {
  const response = await timedFetch(`${GEMINI_BASE}/models?pageSize=100`, {
    headers: { 'x-goog-api-key': env.GEMINI_API_KEY }
  }, 5000);
  if (!response.ok) throw new Error('Gemini model discovery failed');
  const data = await response.json();
  const models = (data?.models || []).filter(m =>
    m?.name?.startsWith('models/') &&
    m?.supportedGenerationMethods?.includes('generateContent') &&
    /flash/i.test(m.name) && !/image|audio|tts|live|embedding/i.test(m.name)
  );
  const preferred = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];
  models.sort((a, b) => {
    const x = preferred.indexOf(a.name.slice(7)), y = preferred.indexOf(b.name.slice(7));
    return (x < 0 ? 99 : x) - (y < 0 ? 99 : y);
  });
  return models[0]?.name?.slice(7) || null;
}

// Discover accessible Groq chat models when a configured model returns 404.
// Only model IDs are inspected; no resident messages are sent to this endpoint.
async function discoverGroqModels(env) {
  const response = await timedFetch('https://api.groq.com/openai/v1/models', {
    method: 'GET',
    headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` }
  }, 8000);
  if (!response.ok) {
    const error = new Error('Groq model list unavailable');
    error.status = response.status;
    throw error;
  }
  const data = await response.json();
  const ids = (Array.isArray(data?.data) ? data.data : [])
    .filter(m => m && typeof m.id === 'string' && m.active !== false)
    .map(m => m.id)
    .filter(id => /^[A-Za-z0-9._\/-]+$/.test(id))
    .filter(id => !/whisper|speech|tts|audio|guard|moderation|embedding|vision/i.test(id));
  const preferred = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'openai/gpt-oss-20b', 'openai/gpt-oss-120b'];
  ids.sort((a, b) => {
    const rank = x => { const i = preferred.indexOf(x); return i < 0 ? 100 : i; };
    return rank(a) - rank(b);
  });
  return ids;
}

async function callGroq(env, message, model) {
  if (!env.GROQ_API_KEY) throw new Error('Groq key missing');
  const response = await timedFetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: message }],
      temperature: 0.3,
      max_tokens: 350,
      stream: false
    })
  }, 12000);
  if (!response.ok) {
    const error = new Error('Groq HTTP status');
    error.status = response.status;
    // Read only a provider-defined error code, never log or return raw response bodies.
    try {
      const data = await response.json();
      if (typeof data?.error?.code === 'string') error.providerCode = data.error.code.slice(0, 60);
    } catch { /* response may not be JSON */ }
    throw error;
  }
  const data = await response.json();
  const answer = typeof data?.choices?.[0]?.message?.content === 'string'
    ? data.choices[0].message.content.trim() : '';
  if (!answer) throw new Error('Groq empty response');
  return answer;
}

async function callWorkersAI(env, message) {
  if (!env.AI || typeof env.AI.run !== 'function') throw new Error('Workers AI binding missing');
  const model = typeof env.AI_MODEL === 'string' && /^@cf\/[A-Za-z0-9._\/-]+$/.test(env.AI_MODEL)
    ? env.AI_MODEL : '@cf/meta/llama-3.1-8b-instruct';
  // AI.run may not support AbortSignal; avoid unhandled rejections from racing promises.
  const result = await env.AI.run(model, {
    messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: message }],
    max_tokens: 350, temperature: 0.3
  });
  const answer = typeof result?.response === 'string' ? result.response.trim() : '';
  if (!answer) throw new Error('Workers AI empty response');
  return answer;
}

export async function handleAiChat(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS });
  if (request.method !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED', 'الطريقة غير مدعومة');
  if (env.AI_ENABLED !== 'true') return fail(503, 'AI_DISABLED', 'المساعد الذكي غير مفعّل حالياً');
  if (!env.DB) return fail(503, 'DB_BINDING_MISSING', 'خدمة التحقق من الجلسات غير متوفرة حالياً');

  const token = (request.headers.get('X-Support-Session') || '').trim();
  if (!token || token.length > 200) return fail(401, 'SESSION_REQUIRED', 'يرجى تسجيل الدخول أولاً');
  let session;
  try {
    session = await env.DB.prepare('SELECT family_id FROM support_sessions WHERE token=? AND expires_at>? LIMIT 1')
      .bind(token, Date.now()).first();
  } catch {
    console.error('AI session DB validation failed');
    return fail(503, 'AI_SESSION_DB_ERROR', 'تعذّر التحقق من جلسة الدخول حالياً');
  }
  if (!session) return fail(401, 'SESSION_EXPIRED', 'انتهت جلسة الدخول');

  let body;
  try { body = await request.json(); }
  catch { return fail(400, 'INVALID_JSON', 'طلب غير صالح'); }
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  if (!message || message.length > 1200) return fail(400, 'INVALID_MESSAGE', 'اكتب رسالة من 1 إلى 1200 حرف');

  // Prefer Groq to avoid delaying every request behind a failing Gemini connection.
  // Expose only safe provider diagnostics, never secrets or raw provider responses.
  const failures = [];
  const recordFailure = (provider, e) => {
    const status = Number(e?.status);
    const reason = e?.name === 'AbortError' ? 'TIMEOUT'
      : Number.isInteger(status) && status >= 400 && status <= 599 ? `HTTP_${status}`
      : e?.message === 'Workers AI binding missing' ? 'BINDING_MISSING'
      : e?.message === 'Groq key missing' ? 'KEY_MISSING'
      : 'REQUEST_FAILED';
    failures.push({ provider, reason });
    console.warn('AI provider failed', provider, reason);
  };
  if (env.GROQ_API_KEY) {
    const configured = safeModel(env.GROQ_MODEL) ? env.GROQ_MODEL : 'llama-3.3-70b-versatile';
    try {
      const answer = await callGroq(env, message, configured);
      return reply({ ok: true, reply: answer, mode: 'informational', provider: 'groq', actions: [] });
    } catch (e) {
      recordFailure('groq', e);
      if (e?.status === 404) {
        try {
          const models = await discoverGroqModels(env);
          const alternative = models.find(id => id !== configured);
          if (alternative) {
            try {
              const answer = await callGroq(env, message, alternative);
              return reply({ ok: true, reply: answer, mode: 'informational', provider: 'groq', actions: [] });
            } catch (retryError) { recordFailure('groq-alternative', retryError); }
          } else failures.push({ provider: 'groq-discovery', reason: 'NO_ALTERNATIVE_MODEL' });
        } catch (discoveryError) { recordFailure('groq-discovery', discoveryError); }
      }
    }
  } else failures.push({ provider: 'groq', reason: 'KEY_MISSING' });

  if (env.GEMINI_API_KEY) {
    const model = safeModel(env.GEMINI_MODEL) ? env.GEMINI_MODEL : 'gemini-flash-latest';
    try {
      const answer = await callGemini(env, message, model);
      return reply({ ok: true, reply: answer, mode: 'informational', provider: 'gemini', actions: [] });
    } catch (e) {
      recordFailure('gemini', e);
      if (e?.status === 404) {
        try {
          const discovered = await discoverGeminiModel(env);
          if (discovered && discovered !== model) {
            const answer = await callGemini(env, message, discovered);
            return reply({ ok: true, reply: answer, mode: 'informational', provider: 'gemini', actions: [] });
          }
        } catch (discoveryError) { recordFailure('gemini-discovery', discoveryError); }
      }
    }
  } else failures.push({ provider: 'gemini', reason: 'KEY_MISSING' });

  if (env.AI && typeof env.AI.run === 'function') {
    try {
      const answer = await callWorkersAI(env, message);
      return reply({ ok: true, reply: answer, mode: 'informational', provider: 'workers-ai', actions: [] });
    } catch (e) { recordFailure('workers-ai', e); }
  } else failures.push({ provider: 'workers-ai', reason: 'BINDING_MISSING' });
  return reply({
    ok: false, code: 'AI_PROVIDERS_UNAVAILABLE',
    error: 'تعذّر تشغيل المساعد. تشخيص: ' + failures.map(f => f.provider + '=' + f.reason).join(' | '),
    diagnostics: failures
  }, 503);
}
