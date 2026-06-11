const CONTENT_KEY = 'site-content';
const CONTACT_KEY = 'contact-requests';

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

function getAdminPassword(env) {
  return env.ADMIN_PASSWORD || null;
}

function checkPassword(password, env) {
  const expected = getAdminPassword(env);
  if (!expected) return { ok: false, status: 500, error: 'ADMIN_PASSWORD is not configured in Cloudflare' };
  if (String(password || '') !== String(expected)) return { ok: false, status: 401, error: 'Wrong admin password' };
  return { ok: true };
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
    sections: {
      vision: {},
      catalog: {},
      operations: { steps: [], terminal: [] },
      contact: {}
    },
    services: [],
    company: {},
    seo: {},
    legal: {}
  };
}

async function handleAuth(request, env) {
  if (request.method === 'OPTIONS') return json({ ok: true });
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

  const body = await request.json().catch(() => null);
  const result = checkPassword(body?.password, env);

  if (!result.ok) return json({ ok: false, error: result.error }, result.status);

  return json({
    ok: true,
    authenticated: true,
    adminPasswordConfigured: true,
    now: new Date().toISOString()
  });
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
    kvWriteTest,
    kvReadTest,
    contentKey: CONTENT_KEY,
    now: new Date().toISOString()
  });
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
    const auth = checkPassword(body?.password, env);
    if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);

    if (!body?.content || typeof body.content !== 'object') {
      return json({ ok: false, error: 'Missing content object' }, 400);
    }

    if (!kv) {
      return json({ ok: false, error: 'KV binding is missing. Add CONTENT binding to this Worker.' }, 500);
    }

    const cleanContent = { ...body.content };
    delete cleanContent._cms;
    cleanContent.updatedAt = new Date().toISOString();

    await kv.put(CONTENT_KEY, JSON.stringify(cleanContent));

    const verify = await kv.get(CONTENT_KEY, 'json');

    return json({
      ok: true,
      source: 'kv',
      key: CONTENT_KEY,
      binding: env.CONTENT ? 'CONTENT' : 'SITE_CONTENT',
      updatedAt: cleanContent.updatedAt,
      verified: !!verify,
      servicesCount: Array.isArray(cleanContent.services) ? cleanContent.services.length : 0
    });
  }

  return json({ ok: false, error: 'Method not allowed' }, 405);
}


async function handleResetContent(request, env) {
  if (request.method === 'OPTIONS') return json({ ok: true });
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

  const body = await request.json().catch(() => null);
  const auth = checkPassword(body?.password, env);

  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);

  const kv = getKV(env);
  if (!kv) {
    return json({ ok: false, error: 'KV binding is missing. Add CONTENT binding to this Worker.' }, 500);
  }

  const bundled = await fallbackContent(request, env);
  delete bundled._cms;
  bundled.updatedAt = new Date().toISOString();
  bundled.restoredFromArchive = true;

  await kv.put(CONTENT_KEY, JSON.stringify(bundled));

  const verify = await kv.get(CONTENT_KEY, 'json');

  return json({
    ok: true,
    restored: true,
    source: 'archive-data-content-json',
    key: CONTENT_KEY,
    binding: env.CONTENT ? 'CONTENT' : 'SITE_CONTENT',
    verified: !!verify,
    servicesCount: Array.isArray(bundled.services) ? bundled.services.length : 0,
    updatedAt: bundled.updatedAt
  });
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
    const auth = checkPassword(url.searchParams.get('password'), env);
    if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);

    const requests = kv ? await kv.get(CONTACT_KEY, 'json') : [];
    return json({ ok: true, requests: requests || [], stored: !!kv });
  }

  return json({ ok: false, error: 'Method not allowed' }, 405);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/auth') return handleAuth(request, env);
    if (url.pathname === '/api/health') return handleHealth(request, env);
    if (url.pathname === '/api/content') return handleContent(request, env);
    if (url.pathname === '/api/reset-content') return handleResetContent(request, env);
    if (url.pathname === '/api/contact') return handleContact(request, env);

    if (url.pathname === '/admin') {
      return Response.redirect(`${url.origin}/admin/`, 301);
    }

    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);

    if (
      url.pathname === '/' ||
      url.pathname.endsWith('.html') ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css')
    ) {
      headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};
