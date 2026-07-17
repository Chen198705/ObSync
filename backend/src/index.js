// Worker 入口
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request, event.env));
});

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check
  if (path === '/health') {
    return new Response(JSON.stringify({ status: 'ok', message: 'Worker is running' }), { headers: corsHeaders });
  }

  // Bind start
  if (request.method === 'POST' && path === '/v1/bind/start') {
    try {
      const body = await request.json();
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      
      await env.OBSYNC_KV.put('bind:' + code, JSON.stringify({
        code: code,
        deviceName: body.deviceName,
        vaultName: body.vaultName,
        expiresAt: Date.now() + 5 * 60 * 1000,
        status: 'pending',
      }), { expirationTtl: 600 });

      return new Response(JSON.stringify({ code: code, expiresAt: expiresAt }), { headers: corsHeaders });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
  }

  // Bind status
  if (request.method === 'GET' && path.startsWith('/v1/bind/status')) {
    const code = url.searchParams.get('code');
    if (!code) {
      return new Response(JSON.stringify({ error: 'Missing code' }), { status: 400, headers: corsHeaders });
    }
    
    const bindingStr = await env.OBSYNC_KV.get('bind:' + code);
    if (!bindingStr) {
      return new Response(JSON.stringify({ status: 'expired' }), { headers: corsHeaders });
    }

    const binding = JSON.parse(bindingStr);
    if (Date.now() > binding.expiresAt) {
      return new Response(JSON.stringify({ status: 'expired' }), { headers: corsHeaders });
    }

    if (binding.status === 'confirmed' && binding.userId && binding.token) {
      return new Response(JSON.stringify({
        status: 'confirmed',
        token: binding.token,
        userId: binding.userId,
      }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ status: 'pending' }), { headers: corsHeaders });
  }

  // Bind confirm
  if (request.method === 'POST' && path === '/v1/bind/confirm') {
    try {
      const body = await request.json();
      const bindingStr = await env.OBSYNC_KV.get('bind:' + body.code);
      
      if (!bindingStr) {
        return new Response(JSON.stringify({ error: '绑定码不存在' }), { status: 400, headers: corsHeaders });
      }

      const binding = JSON.parse(bindingStr);
      if (Date.now() > binding.expiresAt) {
        return new Response(JSON.stringify({ error: '绑定码已过期' }), { status: 400, headers: corsHeaders });
      }

      if (binding.status === 'confirmed') {
        return new Response(JSON.stringify({ error: '绑定码已使用' }), { status: 400, headers: corsHeaders });
      }

      const userId = body.userId || ('usr_' + Math.random().toString(36).substring(2, 15));
      const token = 'obs_' + Math.random().toString(36).substring(2, 15);

      binding.status = 'confirmed';
      binding.userId = userId;
      binding.token = token;
      await env.OBSYNC_KV.put('bind:' + body.code, JSON.stringify(binding), { expirationTtl: 600 });
      await env.OBSYNC_KV.put('token:' + token, userId, { expirationTtl: 365 * 24 * 60 * 60 });

      return new Response(JSON.stringify({ success: true, userId: userId, token: token }), { headers: corsHeaders });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
  }

  // Save article
  if (request.method === 'POST' && path === '/v1/articles/save') {
    try {
      const body = await request.json();
      const userId = body.userId || ('usr_' + Math.random().toString(36).substring(2, 15));
      const id = 'art_' + Math.random().toString(36).substring(2, 15);
      const savedAt = new Date().toISOString();

      const article = {
        id: id,
        userId: userId,
        title: body.title,
        sourceUrl: body.sourceUrl,
        account: body.account,
        author: body.author,
        savedAt: savedAt,
        markdown: body.markdown,
        acknowledged: false,
      };

      await env.OBSYNC_KV.put('articles:' + userId + ':' + id, JSON.stringify(article));
      return new Response(JSON.stringify({ id: id, savedAt: savedAt, userId: userId }), { headers: corsHeaders });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
  }

  // List articles
  if (request.method === 'GET' && path === '/v1/articles/list') {
    const userId = url.searchParams.get('userId');
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing userId' }), { status: 400, headers: corsHeaders });
    }

    const list = await env.OBSYNC_KV.list({ prefix: 'articles:' + userId + ':' });
    const articles = [];
    
    for (const key of list.keys) {
      const articleStr = await env.OBSYNC_KV.get(key.name);
      if (articleStr) {
        const a = JSON.parse(articleStr);
        articles.push({
          id: a.id,
          title: a.title,
          sourceUrl: a.sourceUrl,
          account: a.account,
          savedAt: a.savedAt,
        });
      }
    }

    return new Response(JSON.stringify({ articles: articles }), { headers: corsHeaders });
  }

  return new Response(JSON.stringify({ error: 'Not found', path: path }), { status: 404, headers: corsHeaders });
}
