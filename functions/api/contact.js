const CONTACT_KEY = 'contact-requests';

const json = (data, status = 200) => new Response(JSON.stringify(data, null, 2), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  }
});

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: 'Invalid request' }, 400);

  const requestItem = {
    id: crypto.randomUUID(),
    name: String(body.name || '').slice(0, 200),
    email: String(body.email || '').slice(0, 200),
    message: String(body.message || '').slice(0, 2000),
    page: String(body.page || '').slice(0, 300),
    createdAt: new Date().toISOString()
  };

  if (env.SITE_CONTENT) {
    const existing = await env.SITE_CONTENT.get(CONTACT_KEY, 'json') || [];
    existing.unshift(requestItem);
    await env.SITE_CONTENT.put(CONTACT_KEY, JSON.stringify(existing.slice(0, 200)));
  }

  return json({ ok: true, request: requestItem });
}

export async function onRequestGet({ request, env }) {
  if (!env.ADMIN_PASSWORD) return json({ error: 'ADMIN_PASSWORD is not configured' }, 500);
  const url = new URL(request.url);
  const password = url.searchParams.get('password');
  if (password !== env.ADMIN_PASSWORD) return json({ error: 'Unauthorized' }, 401);

  const requests = env.SITE_CONTENT ? await env.SITE_CONTENT.get(CONTACT_KEY, 'json') : [];
  return json({ requests: requests || [] });
}
