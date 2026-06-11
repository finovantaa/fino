const CONTENT_KEY = 'site-content';

const defaultContent = async (env) => {
  try {
    const asset = await env.ASSETS.fetch(new Request('https://assets.local/data/content.json'));
    if (asset.ok) return await asset.json();
  } catch (error) {}
  return { site: {}, services: [] };
};

const json = (data, status = 200) => new Response(JSON.stringify(data, null, 2), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  }
});

export async function onRequestGet({ env }) {
  const saved = env.SITE_CONTENT ? await env.SITE_CONTENT.get(CONTENT_KEY, 'json') : null;
  return json(saved || await defaultContent(env));
}

export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_PASSWORD) return json({ error: 'ADMIN_PASSWORD is not configured' }, 500);

  const body = await request.json().catch(() => null);
  if (!body || body.password !== env.ADMIN_PASSWORD) return json({ error: 'Unauthorized' }, 401);
  if (!body.content || typeof body.content !== 'object') return json({ error: 'Missing content' }, 400);
  if (!env.SITE_CONTENT) return json({ error: 'SITE_CONTENT KV binding is not configured' }, 500);

  const content = {
    ...body.content,
    updatedAt: new Date().toISOString()
  };

  await env.SITE_CONTENT.put(CONTENT_KEY, JSON.stringify(content));
  return json({ ok: true, updatedAt: content.updatedAt });
}
