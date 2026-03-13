const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // GET /strips — list all non-expired strips
    if (request.method === 'GET' && path === '/strips') {
      const list = await env.PHOTO_VAULT.list({ prefix: 'strip:' });
      const now = Date.now();
      const strips = [];

      for (const key of list.keys) {
        const val = await env.PHOTO_VAULT.get(key.name);
        if (!val) continue;
        try {
          const entry = JSON.parse(val);
          if (entry.expiresAt < now) {
            await env.PHOTO_VAULT.delete(key.name);
            continue;
          }
          strips.push(entry);
        } catch (_) {}
      }

      strips.sort((a, b) => b.uploadedAt - a.uploadedAt);
      return new Response(JSON.stringify(strips), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // POST /strips — save a new strip
    if (request.method === 'POST' && path === '/strips') {
      try {
        const body = await request.json();
        const id = 'strip:' + Date.now() + ':' + Math.random().toString(36).slice(2, 7);
        const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
        const entry = {
          id,
          image: body.image,
          caption: body.caption || '',
          date: body.date || '',
          uploadedAt: Date.now(),
          expiresAt: Date.now() + THIRTY_DAYS,
        };
        // Store with TTL so KV auto-deletes after 30 days
        await env.PHOTO_VAULT.put(id, JSON.stringify(entry), {
          expirationTtl: 30 * 24 * 60 * 60,
        });
        return new Response(JSON.stringify({ ok: true, id }), {
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: e.message }), {
          status: 400,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response('Not found', { status: 404, headers: CORS });
  },
};
