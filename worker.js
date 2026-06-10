const CONTENT_KEY = 'site-content';
const CONTACT_KEY = 'contact-requests';

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function getKV(env) {
  return env.SITE_CONTENT || env.CONTENT || null;
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
      heroText: 'FINOVANTA designs, develops and maintains clean digital tools: web applications, automation layers, API integrations and operational dashboards for companies that need reliable execution.',
      rootNote: 'Practical systems, documented delivery and long-term technical maintenance. Built for companies that need software to stay understandable after launch.'
    },
    services: []
  };
}

async function handleContent(request, env) {
  const kv = getKV(env);

  if (request.method === 'GET') {
    if (kv) {
      const saved = await kv.get(CONTENT_KEY, 'json');
      if (saved) return json(saved);
    }
    return json(await fallbackContent(request, env));
  }

  if (request.method === 'POST') {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    if (!env.ADMIN_PASSWORD) {
      return json({ error: 'ADMIN_PASSWORD is not configured' }, 500);
    }

    if (body.password !== env.ADMIN_PASSWORD) {
      return json({ error: 'Unauthorized' }, 401);
    }

    if (!body.content || typeof body.content !== 'object') {
      return json({ error: 'Missing content' }, 400);
    }

    if (!kv) {
      return json({ error: 'KV binding is not configured. Add CONTENT or SITE_CONTENT binding.' }, 500);
    }

    const content = {
      ...body.content,
      updatedAt: new Date().toISOString(),
    };

    await kv.put(CONTENT_KEY, JSON.stringify(content));
    return json({ ok: true, updatedAt: content.updatedAt });
  }

  return json({ error: 'Method not allowed' }, 405);
}

async function handleContact(request, env) {
  const kv = getKV(env);

  if (request.method === 'POST') {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return json({ error: 'Invalid JSON body' }, 400);
    }

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

    return json({ ok: true, request: requestItem });
  }

  if (request.method === 'GET') {
    if (!env.ADMIN_PASSWORD) {
      return json({ error: 'ADMIN_PASSWORD is not configured' }, 500);
    }

    const url = new URL(request.url);
    const password = url.searchParams.get('password');

    if (password !== env.ADMIN_PASSWORD) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const requests = kv ? await kv.get(CONTACT_KEY, 'json') : [];
    return json({ requests: requests || [] });
  }

  return json({ error: 'Method not allowed' }, 405);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/content') {
      return handleContent(request, env);
    }

    if (url.pathname === '/api/contact') {
      return handleContact(request, env);
    }

    if (url.pathname === '/admin') {
      return Response.redirect(`${url.origin}/admin/`, 301);
    }

    return env.ASSETS.fetch(request);
  },
};
