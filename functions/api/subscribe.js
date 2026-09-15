/**
 * Cloudflare Pages Function — store a Web Push subscription in KV.
 * Bind KV namespace as SUBSCRIPTIONS (dashboard or wrangler.toml).
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.SUBSCRIPTIONS) {
    return json({ error: 'SUBSCRIPTIONS KV binding missing' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const sub = body?.subscription || body;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return json({ error: 'Invalid subscription' }, 400);
  }

  const id = hashEndpoint(sub.endpoint);
  await env.SUBSCRIPTIONS.put(
    id,
    JSON.stringify({
      endpoint: sub.endpoint,
      keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      createdAt: new Date().toISOString(),
    }),
  );

  return json({ ok: true, id }, 201);
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  if (!env.SUBSCRIPTIONS) return json({ error: 'KV missing' }, 500);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const endpoint = body?.endpoint;
  if (!endpoint) return json({ error: 'endpoint required' }, 400);

  await env.SUBSCRIPTIONS.delete(hashEndpoint(endpoint));
  return json({ ok: true });
}

function hashEndpoint(endpoint) {
  let h = 5381;
  for (let i = 0; i < endpoint.length; i++) {
    h = ((h << 5) + h + endpoint.charCodeAt(i)) | 0;
  }
  return `sub_${(h >>> 0).toString(16)}`;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
