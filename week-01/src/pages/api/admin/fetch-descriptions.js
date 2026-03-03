import { getLinksNeedingFetch, getYellowLinks, updateLinkStatus } from '../../../lib/db.js';

const LAN_RE = /^https?:\/\/(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)/i;
const DEAD_STATUSES = new Set([404, 410]);
const DEAD_CODES    = new Set(['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT']);

// ── Extraction helpers ────────────────────────────────────────────────────────

function extractMetaDesc(html) {
  const patterns = [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"'<>]{10,})/i,
    /<meta[^>]+content=["']([^"'<>]{10,})["'][^>]+name=["']description["']/i,
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"'<>]{10,})/i,
    /<meta[^>]+content=["']([^"'<>]{10,})["'][^>]+property=["']og:description["']/i,
    /<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"'<>]{10,})/i,
    /<meta[^>]+content=["']([^"'<>]{10,})["'][^>]+name=["']twitter:description["']/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

// JSON-LD structured data — many sites omit meta but include schema.org markup.
function extractJsonLdDesc(html) {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      const data  = JSON.parse(m[1]);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item.description && typeof item.description === 'string' && item.description.length >= 20) {
          return item.description.trim();
        }
        // @graph array (common in schema.org)
        if (Array.isArray(item['@graph'])) {
          for (const node of item['@graph']) {
            if (node.description && typeof node.description === 'string' && node.description.length >= 20) {
              return node.description.trim();
            }
          }
        }
      }
    } catch { /* malformed JSON-LD — skip */ }
  }
  return null;
}

function stripTags(s) {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract first substantial paragraph from body content.
// Tries <main> / <article> first, then whole <body>.
function extractBodyDesc(html) {
  // Strip noise before searching
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '');

  const containers = [
    (cleaned.match(/<main[^>]*>([\s\S]*?)<\/main>/i)    ?? [])[1],
    (cleaned.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ?? [])[1],
    (cleaned.match(/<body[^>]*>([\s\S]*)/i)             ?? [])[1],
  ];

  for (const block of containers) {
    if (!block) continue;
    const pRe = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let pm;
    while ((pm = pRe.exec(block)) !== null) {
      const text = stripTags(pm[1]);
      if (text.length >= 40) {
        return text.length > 220 ? text.substring(0, 217).replace(/\s\S+$/, '') + '…' : text;
      }
    }
  }
  return null;
}

// ── Fetch + classify one link ─────────────────────────────────────────────────

async function processLink(link, recheck) {
  if (LAN_RE.test(link.url)) return { status: 'blue', newDesc: null };

  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    let res;
    try {
      res = await fetch(link.url, {
        signal: ctrl.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Dashboard-Bot/1.0)',
          'Accept': 'text/html,application/xhtml+xml',
        },
        redirect: 'follow',
      });
    } finally {
      clearTimeout(timer);
    }

    if (DEAD_STATUSES.has(res.status)) return { status: 'red', newDesc: null };

    // Read HTML — 64 KB is enough for <head> on first pass;
    // recheck reads up to 256 KB to reach body content.
    const limit  = recheck ? 262144 : 65536;
    const reader = res.body.getReader();
    let html = '', bytes = 0;
    while (bytes < limit) {
      const { done, value } = await reader.read();
      if (done) break;
      html  += new TextDecoder().decode(value);
      bytes += value.length;
    }
    reader.cancel();

    // Try extraction methods in order of reliability
    const desc = extractMetaDesc(html)
      ?? (recheck ? extractJsonLdDesc(html) : null)
      ?? (recheck ? extractBodyDesc(html)   : null);

    if (desc) {
      const existing = link.description?.trim();
      return {
        status:  'green',
        newDesc: existing ? `${existing} — ${desc}` : desc,
      };
    }
    return { status: 'yellow', newDesc: null };

  } catch (err) {
    const code = err?.cause?.code ?? err?.code;
    return { status: DEAD_CODES.has(code) ? 'red' : 'yellow', newDesc: null };
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST({ request, url }) {
  const recheck    = url.searchParams.get('recheck') === '1';
  const links      = recheck ? getYellowLinks() : getLinksNeedingFetch();
  const total      = links.length;
  const encoder    = new TextEncoder();
  const abortSignal = request.signal;

  const stream = new ReadableStream({
    async start(controller) {
      function send(data) {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); }
        catch { /* client disconnected */ }
      }

      send({ type: 'start', total });
      let done = 0, green = 0, yellow = 0, red = 0, blue = 0;

      for (const link of links) {
        if (abortSignal?.aborted) break;
        done++;

        const { status, newDesc } = await processLink(link, recheck);

        // In recheck mode only write back if we found something new
        if (!recheck || status === 'green') {
          updateLinkStatus(link.id, status, newDesc);
        }

        if      (status === 'green')  green++;
        else if (status === 'yellow') yellow++;
        else if (status === 'red')    red++;
        else                          blue++;

        send({ type: 'progress', done, total, id: link.id, name: link.name, status });

        if (done < total && !abortSignal?.aborted) {
          await new Promise(r => setTimeout(r, 400));
        }
      }

      send({ type: 'done', done, total, green, yellow, red, blue });
      try { controller.close(); } catch { /* already closed */ }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}
