const CONTENT_KEY = 'site-content';
const CONTACT_KEY = 'contact-requests';
const DEFAULT_ADMIN_PASSWORD = 'FinovantaAdmin2026!';

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    },
  });
}

function getKV(env) {
  return env.CONTENT || env.SITE_CONTENT || null;
}

function getPassword(env) {
  return env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
}

function isAuthorized(bodyOrPassword, env) {
  const password = typeof bodyOrPassword === 'string' ? bodyOrPassword : bodyOrPassword?.password;
  return password === getPassword(env);
}

async function fallbackContent(request, env) {
  try {
    const url = new URL('/data/content.json', request.url);
    const response = await env.ASSETS.fetch(new Request(url));
    if (response.ok) return await response.json();
  } catch (error) {}

  return {
    site: {
      brand: 'FINOVANTA',
      eyebrow: '[ .001 ]  Paris software company',
      heroTitle: 'Software infrastructure for business workflows.',
      heroText: 'FINOVANTA designs, develops and maintains clean digital tools.',
      primaryButton: '[ request consultation ]',
      secondaryButton: '[ view service catalog ]',
      rootNote: 'Practical systems, documented delivery and long-term technical maintenance.'
    },
    sections: {},
    services: [],
    company: {},
    seo: {},
    legal: {}
  };
}

async function handleContent(request, env) {
  const kv = getKV(env);

  if (request.method === 'OPTIONS') return json({ ok: true });

  if (request.method === 'GET') {
    if (kv) {
      const saved = await kv.get(CONTENT_KEY, 'json');
      if (saved) {
        return json({
          ...saved,
          _cms: {
            source: 'kv',
            key: CONTENT_KEY,
            binding: env.CONTENT ? 'CONTENT' : 'SITE_CONTENT',
            loadedAt: new Date().toISOString()
          }
        });
      }
    }

    return json({
      ...(await fallbackContent(request, env)),
      _cms: {
        source: 'fallback-data-content-json',
        key: CONTENT_KEY,
        binding: kv ? (env.CONTENT ? 'CONTENT' : 'SITE_CONTENT') : null,
        loadedAt: new Date().toISOString()
      }
    });
  }

  if (request.method === 'POST') {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return json({ ok: false, error: 'Invalid JSON body' }, 400);
    }

    if (!isAuthorized(body, env)) {
      return json({ ok: false, error: 'Wrong admin password' }, 401);
    }

    if (!body.content || typeof body.content !== 'object') {
      return json({ ok: false, error: 'Missing content object' }, 400);
    }

    if (!kv) {
      return json({
        ok: false,
        error: 'KV binding is missing. Add CONTENT or SITE_CONTENT binding to this Worker.',
        expectedBindings: ['CONTENT', 'SITE_CONTENT']
      }, 500);
    }

    const cleanContent = { ...body.content };
    delete cleanContent._cms;

    const savedContent = {
      ...cleanContent,
      updatedAt: new Date().toISOString()
    };

    await kv.put(CONTENT_KEY, JSON.stringify(savedContent));

    // Verify write
    const verify = await kv.get(CONTENT_KEY, 'json');

    return json({
      ok: true,
      source: 'kv',
      key: CONTENT_KEY,
      binding: env.CONTENT ? 'CONTENT' : 'SITE_CONTENT',
      updatedAt: savedContent.updatedAt,
      verified: !!verify
    });
  }

  return json({ ok: false, error: 'Method not allowed' }, 405);
}

async function handleContact(request, env) {
  const kv = getKV(env);

  if (request.method === 'OPTIONS') return json({ ok: true });

  if (request.method === 'POST') {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return json({ ok: false, error: 'Invalid JSON body' }, 400);

    const requestItem = {
      id: crypto.randomUUID(),
      name: String(body.name || '').slice(0, 200),
      email: String(body.email || '').slice(0, 200),
      message: String(body.message || '').slice(0, 2000),
      page: String(body.page || '').slice(0, 300),
      createdAt: new Date().toISOString(),
    };

    if (kv) {
      const existing = await kv.get(CONTACT_KEY, 'json') || [];
      existing.unshift(requestItem);
      await kv.put(CONTACT_KEY, JSON.stringify(existing.slice(0, 200)));
    }

    return json({ ok: true, stored: !!kv, request: requestItem });
  }

  if (request.method === 'GET') {
    const url = new URL(request.url);
    const password = url.searchParams.get('password');

    if (!isAuthorized(password, env)) {
      return json({ ok: false, error: 'Wrong admin password' }, 401);
    }

    const requests = kv ? await kv.get(CONTACT_KEY, 'json') : [];
    return json({ ok: true, requests: requests || [], stored: !!kv });
  }

  return json({ ok: false, error: 'Method not allowed' }, 405);
}

async function handleHealth(request, env) {
  const kv = getKV(env);
  let kvWriteTest = false;
  let kvReadTest = false;

  if (kv) {
    try {
      const testKey = 'cms-health-check';
      const testValue = new Date().toISOString();
      await kv.put(testKey, testValue);
      kvWriteTest = true;
      const readBack = await kv.get(testKey);
      kvReadTest = readBack === testValue;
    } catch (error) {}
  }

  return json({
    ok: true,
    worker: true,
    kvBindingFound: !!kv,
    binding: kv ? (env.CONTENT ? 'CONTENT' : 'SITE_CONTENT') : null,
    adminPasswordConfigured: !!env.ADMIN_PASSWORD,
    fallbackPassword: env.ADMIN_PASSWORD ? false : DEFAULT_ADMIN_PASSWORD,
    kvWriteTest,
    kvReadTest,
    contentKey: CONTENT_KEY,
    now: new Date().toISOString()
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/content') return handleContent(request, env);
    if (url.pathname === '/api/contact') return handleContact(request, env);
    if (url.pathname === '/api/health') return handleHealth(request, env);

    if (url.pathname === '/admin') {
      return Response.redirect(`${url.origin}/admin/`, 301);
    }

    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);

    // Do not cache HTML/JS/CSS during active editing.
    if (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
      headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};
