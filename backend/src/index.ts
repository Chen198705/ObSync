import type { 
  BindStartResponse, BindStatusResponse,
  SyncArticlesResponse, AckRequest, Article
} from './types';

interface Env {
  OBSYNC_KV: KVNamespace;
}

// ==================== Helper Functions ====================
function generateId(prefix: string): string {
  const random = Math.random().toString(36).substring(2, 15) + 
                 Math.random().toString(36).substring(2, 15);
  return `${prefix}_${random}`;
}

function generateBindCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generateToken(): string {
  const random = Math.random().toString(36).substring(2, 15) + 
                 Math.random().toString(36).substring(2, 15);
  return `obs_${random}`;
}

function generateUserId(): string {
  const random = Math.random().toString(36).substring(2, 15);
  return `usr_${random}`;
}

async function verifyToken(authHeader: string | null, env: Env): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.slice(7);
  const userId = await env.OBSYNC_KV.get(`token:${token}`);
  
  return userId;
}

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };
}

// ==================== Article Fetching ====================
interface ParsedArticle {
  title: string;
  author: string;
  account: string;
  publishedAt: string;
  content: string;
  sourceUrl: string;
}

async function fetchWechatArticle(url: string): Promise<ParsedArticle> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Referer': 'https://mp.weixin.qq.com/',
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch article: ${response.status}`);
  }

  const html = await response.text();

  // 提取标题 - 多种方式尝试
  let title = extractByRegex(html, /<h1[^>]*class=["'][^"']*rich_media_title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i);
  if (!title) {
    title = extractByRegex(html, /<title>([^<]+)<\/title>/);
  }
  if (!title) {
    title = extractByRegex(html, /og:title["']\s*content=["']([^"']+)["']/i);
  }
  title = cleanHtml(title || '未命名文章');

  // 提取作者
  let author = extractByRegex(html, /<span[^>]*id=["']js_name["'][^>]*>([^<]+)<\/span>/);
  if (!author) {
    author = extractByRegex(html, /<strong[^>]*class=["'][^"']*rich_media_meta[^"']*nickname[^"']*["'][^>]*>([^<]+)<\/strong>/);
  }
  author = cleanHtml(author || '');

  // 提取公众号名称
  let account = extractByRegex(html, /<span[^>]*id=["']js_name["'][^>]*>([^<]+)<\/span>/);
  if (!account) {
    account = extractByRegex(html, /og:article:author["']\s*content=["']([^"']+)["']/i);
  }
  account = cleanHtml(account || '');

  // 提取发布时间
  let publishedAt = extractByRegex(html, /<em[^>]*id=["']publish_time["'][^>]*>([^<]+)<\/em>/);
  if (!publishedAt) {
    publishedAt = extractByRegex(html, /ct发表于\s*([^\s<]+)/);
  }
  publishedAt = cleanHtml(publishedAt || '');

  // 提取正文内容
  let content = extractByRegex(html, /<div[^>]*id=["']js_content["'][^>]*>([\s\S]*?)<\/div>\s*<div[^>]*id=["']js_pc_qr_code["']/);
  if (!content) {
    content = extractByRegex(html, /<div[^>]*class=["'][^"']*rich_media_content[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<div[^>]*class=["'][^"']*js_pc_qr_code[^"']*["']/);
  }
  if (!content) {
    content = extractByRegex(html, /<section[^>]*data-brushtype=["']text["']([\s\S]*?)<\/section>/);
  }

  // 转换为 Markdown
  const markdown = htmlToMarkdown(content || '');

  return {
    title,
    author,
    account,
    publishedAt,
    content: markdown,
    sourceUrl: url
  };
}

function extractByRegex(html: string, regex: RegExp): string {
  const match = html.match(regex);
  return match ? match[1] : '';
}

function cleanHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…')
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/<img[^>]*>/gi, '[图片]')
    .replace(/\s+/g, ' ')
    .trim();
}

function htmlToMarkdown(html: string): string {
  if (!html) return '';

  let md = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // 处理标题
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n## $1\n\n');
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n### $1\n\n');
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n#### $1\n\n');
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n##### $1\n\n');

  // 处理段落
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
  md = md.replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '$1\n\n');

  // 处理换行
  md = md.replace(/<br\s*\/?>/gi, '\n');

  // 处理图片
  md = md.replace(/<img[^>]*data-src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*>/gi, '![$2]($1)');
  md = md.replace(/<img[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*>/gi, '![$2]($1)');
  md = md.replace(/<img[^>]*data-src=["']([^"']+)["'][^>]*>/gi, '![]($1)');
  md = md.replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi, '![]($1)');

  // 处理链接
  md = md.replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

  // 处理加粗和斜体
  md = md.replace(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, '**$1**');
  md = md.replace(/<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, '*$1*');
  md = md.replace(/<span[^>]*style=["'][^"']*font-weight[^"']*bold[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi, '**$1**');

  // 处理列表
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
  md = md.replace(/<ul[^>]*>/gi, '\n');
  md = md.replace(/<\/ul>/gi, '\n');
  md = md.replace(/<ol[^>]*>/gi, '\n');
  md = md.replace(/<\/ol>/gi, '\n');

  // 处理引用
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '\n> $1\n\n');

  // 处理代码块
  md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n');
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');

  // 清理剩余 HTML
  md = cleanHtml(md);

  // 清理多余空行
  md = md.replace(/\n{3,}/g, '\n\n');
  md = md.trim();

  return md;
}

// ==================== Request Handlers ====================
async function handleBindStart(request: Request, env: Env): Promise<Response> {
  const body = await request.json<{ deviceName: string; vaultName: string }>();
  const { deviceName, vaultName } = body;

  const code = generateBindCode();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  await env.OBSYNC_KV.put(`bind:${code}`, JSON.stringify({
    code,
    deviceName,
    vaultName,
    expiresAt: Date.now() + 5 * 60 * 1000,
    status: 'pending',
  }), { expirationTtl: 600 });

  return new Response(JSON.stringify({ code, expiresAt } as BindStartResponse), {
    headers: corsHeaders(),
  });
}

async function handleBindStatus(code: string, env: Env): Promise<Response> {
  const bindingStr = await env.OBSYNC_KV.get(`bind:${code}`);
  
  if (!bindingStr) {
    return new Response(JSON.stringify({ status: 'expired' } as BindStatusResponse), {
      headers: corsHeaders(),
    });
  }

  const binding = JSON.parse(bindingStr);

  if (Date.now() > binding.expiresAt) {
    return new Response(JSON.stringify({ status: 'expired' } as BindStatusResponse), {
      headers: corsHeaders(),
    });
  }

  if (binding.status === 'confirmed' && binding.userId && binding.token) {
    return new Response(JSON.stringify({
      status: 'confirmed',
      token: binding.token,
      userId: binding.userId,
    } as BindStatusResponse), {
      headers: corsHeaders(),
    });
  }

  return new Response(JSON.stringify({ status: 'pending' } as BindStatusResponse), {
    headers: corsHeaders(),
  });
}

async function handleBindConfirm(request: Request, env: Env): Promise<Response> {
  const { code, userId: providedUserId } = await request.json<{ code: string; userId?: string }>();
  
  const bindingStr = await env.OBSYNC_KV.get(`bind:${code}`);
  
  if (!bindingStr) {
    return new Response(JSON.stringify({ error: '绑定码不存在' }), {
      status: 400,
      headers: corsHeaders(),
    });
  }

  const binding = JSON.parse(bindingStr);
  
  if (Date.now() > binding.expiresAt) {
    return new Response(JSON.stringify({ error: '绑定码已过期' }), {
      status: 400,
      headers: corsHeaders(),
    });
  }

  if (binding.status === 'confirmed') {
    return new Response(JSON.stringify({ error: '绑定码已使用' }), {
      status: 400,
      headers: corsHeaders(),
    });
  }

  const userId = providedUserId || generateUserId();
  const token = generateToken();

  binding.status = 'confirmed';
  binding.userId = userId;
  binding.token = token;
  await env.OBSYNC_KV.put(`bind:${code}`, JSON.stringify(binding), { expirationTtl: 600 });
  await env.OBSYNC_KV.put(`token:${token}`, userId, { expirationTtl: 365 * 24 * 60 * 60 });
  await env.OBSYNC_KV.put(`user:${userId}`, JSON.stringify({
    id: userId,
    token,
    createdAt: Date.now(),
  }), { expirationTtl: 365 * 24 * 60 * 60 });

  return new Response(JSON.stringify({ success: true, userId, token }), {
    headers: corsHeaders(),
  });
}

async function handleSyncArticles(userId: string, env: Env): Promise<Response> {
  const list = await env.OBSYNC_KV.list({ prefix: `articles:${userId}:` });
  
  const articles: Article[] = [];
  
  for (const key of list.keys) {
    const articleStr = await env.OBSYNC_KV.get(key.name);
    
    if (articleStr) {
      const article = JSON.parse(articleStr);
      if (!article.acknowledged) {
        articles.push({
          id: article.id,
          title: article.title,
          sourceUrl: article.sourceUrl,
          account: article.account,
          author: article.author,
          publishedAt: article.publishedAt,
          savedAt: article.savedAt,
          markdown: article.markdown,
          contentKind: article.contentKind,
          parseStatus: article.parseStatus,
          parseError: article.parseError,
        });
      }
    }
  }

  articles.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());

  return new Response(JSON.stringify({ articles } as SyncArticlesResponse), {
    headers: corsHeaders(),
  });
}

async function handleAckArticle(userId: string, articleId: string, request: Request, env: Env): Promise<Response> {
  const { writtenPath } = await request.json<AckRequest>();
  
  const key = `articles:${userId}:${articleId}`;
  const articleStr = await env.OBSYNC_KV.get(key);
  
  if (articleStr) {
    const article = JSON.parse(articleStr);
    article.acknowledged = true;
    article.acknowledgedPath = writtenPath;
    await env.OBSYNC_KV.put(key, JSON.stringify(article));
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: corsHeaders(),
  });
}

async function handleSaveArticle(request: Request, env: Env): Promise<Response> {
  const body = await request.json<{
    userId: string;
    title: string;
    sourceUrl: string;
    account?: string;
    author?: string;
    publishedAt?: string;
    markdown: string;
    contentKind?: 'article' | 'file';
    autoFetch?: boolean;
  }>();

  const userId = body.userId || generateUserId();
  const id = generateId('art');
  const savedAt = new Date().toISOString();

  let title = body.title || '';
  let author = body.author || '';
  let account = body.account || '';
  let publishedAt = body.publishedAt || '';
  let markdown = body.markdown || '';

  // 如果开启了自动抓取且有微信文章链接，总是抓取（忽略前端传的标题）
  if (body.autoFetch && body.sourceUrl && body.sourceUrl.includes('mp.weixin.qq.com')) {
    try {
      console.log('Fetching article from:', body.sourceUrl);
      const parsed = await fetchWechatArticle(body.sourceUrl);
      console.log('Fetched article:', JSON.stringify(parsed).substring(0, 500));
      
      // 自动抓取模式下，总是使用抓取的标题
      title = parsed.title || title;
      author = parsed.author || author;
      account = parsed.account || account;
      publishedAt = parsed.publishedAt || publishedAt;
      
      // 如果抓取的正文比传入的更完整，使用抓取的
      if (parsed.content && parsed.content.length > (markdown?.length || 0)) {
        markdown = parsed.content;
      }
    } catch (error: any) {
      console.error('Failed to fetch article:', error);
    }
  }

  // 如果还是没有有效标题，使用默认标题
  if (!title || title === '未命名文章' || title.length < 2) {
    // 尝试从 URL 提取
    const urlMatch = body.sourceUrl?.match(/sn=([^&]+)/);
    if (urlMatch) {
      try {
        title = decodeURIComponent(urlMatch[1]);
      } catch (e) {
        title = '微信文章-' + Date.now().toString(36);
      }
    } else {
      title = '微信文章-' + Date.now().toString(36);
    }
  }

  // 如果还是没有正文，生成一个
  if (!markdown || markdown.length < 50) {
    markdown = `# ${title}\n\n来源: [原文链接](${body.sourceUrl})\n\n公众号: ${account || '未知'}\n作者: ${author || '未知'}\n\n---\n\n[查看原文](${body.sourceUrl})`;
  }

  const article = {
    id,
    userId,
    title,
    sourceUrl: body.sourceUrl,
    account,
    author,
    publishedAt,
    savedAt,
    markdown,
    contentKind: body.contentKind,
    parseStatus: 'success',
    acknowledged: false,
    createdAt: Date.now(),
  };

  await env.OBSYNC_KV.put(`articles:${userId}:${id}`, JSON.stringify(article));

  return new Response(JSON.stringify({ id, savedAt, userId, title }), {
    headers: corsHeaders(),
  });
}

async function handleListArticles(userId: string, env: Env): Promise<Response> {
  const list = await env.OBSYNC_KV.list({ prefix: `articles:${userId}:` });
  
  const articles = [];
  
  for (const key of list.keys) {
    const articleStr = await env.OBSYNC_KV.get(key.name);
    if (articleStr) {
      const article = JSON.parse(articleStr);
      articles.push({
        id: article.id,
        title: article.title,
        sourceUrl: article.sourceUrl,
        account: article.account,
        author: article.author,
        savedAt: article.savedAt,
      });
    }
  }

  articles.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());

  return new Response(JSON.stringify({ articles }), {
    headers: corsHeaders(),
  });
}

async function handleFetchArticle(request: Request, env: Env): Promise<Response> {
  const body = await request.json<{ url: string }>();
  
  if (!body.url) {
    return new Response(JSON.stringify({ error: 'Missing url' }), {
      status: 400,
      headers: corsHeaders(),
    });
  }

  if (!body.url.includes('mp.weixin.qq.com')) {
    return new Response(JSON.stringify({ error: 'Only WeChat articles are supported' }), {
      status: 400,
      headers: corsHeaders(),
    });
  }

  try {
    const article = await fetchWechatArticle(body.url);
    return new Response(JSON.stringify({ success: true, ...article }), {
      headers: corsHeaders(),
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to fetch article'
    }), {
      status: 500,
      headers: corsHeaders(),
    });
  }
}

// ==================== Main Handler ====================
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    try {
      if (request.method === 'POST' && path === '/v1/bind/confirm') {
        return handleBindConfirm(request, env);
      }

      if (request.method === 'POST' && path === '/v1/bind/start') {
        return handleBindStart(request, env);
      }

      if (request.method === 'GET' && path.startsWith('/v1/bind/status')) {
        const code = url.searchParams.get('code');
        if (!code) {
          return new Response(JSON.stringify({ error: 'Missing code parameter' }), {
            status: 400,
            headers: corsHeaders(),
          });
        }
        return handleBindStatus(code, env);
      }

      if (request.method === 'GET' && path === '/v1/sync/articles') {
        const userId = await verifyToken(request.headers.get('Authorization'), env);
        if (!userId) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: corsHeaders(),
          });
        }
        return handleSyncArticles(userId, env);
      }

      if (request.method === 'POST' && path.match(/^\/v1\/sync\/articles\/[^/]+\/ack$/)) {
        const userId = await verifyToken(request.headers.get('Authorization'), env);
        if (!userId) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: corsHeaders(),
          });
        }
        const articleId = path.split('/')[4];
        if (articleId) {
          return handleAckArticle(userId, articleId, request, env);
        }
      }

      if (request.method === 'POST' && path === '/v1/articles/save') {
        return handleSaveArticle(request, env);
      }

      if (request.method === 'GET' && path === '/v1/articles/list') {
        const userId = url.searchParams.get('userId');
        if (!userId) {
          return new Response(JSON.stringify({ error: 'Missing userId' }), {
            status: 400,
            headers: corsHeaders(),
          });
        }
        return handleListArticles(userId, env);
      }

      if (request.method === 'POST' && path === '/v1/articles/fetch') {
        return handleFetchArticle(request, env);
      }

      if (path === '/health') {
        return new Response(JSON.stringify({ status: 'ok' }), {
          headers: corsHeaders(),
        });
      }

      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: corsHeaders(),
      });
    } catch (error) {
      console.error('Error:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: corsHeaders(),
      });
    }
  },
};
