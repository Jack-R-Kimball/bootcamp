import { getLinksNeedingFetch, getYellowLinks, updateLinkStatus } from '../../../lib/db.js';
import { extractMetaDesc, extractJsonLdDesc, extractBodyDesc } from '../../../lib/extract.js';

const LAN_RE      = /^https?:\/\/(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)/i;
const DEAD_STATUSES = new Set([404, 410]);
const DEAD_CODES    = new Set(['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT']);

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

    const desc = extractMetaDesc(html)
      ?? (recheck ? extractJsonLdDesc(html) : null)
      ?? (recheck ? extractBodyDesc(html)   : null);

    if (desc) {
      const existing = link.description?.trim();
      return { status: 'green', newDesc: existing ? `${existing} — ${desc}` : desc };
    }
    return { status: 'yellow', newDesc: null };

  } catch (err) {
    const code = err?.cause?.code ?? err?.code;
    return { status: DEAD_CODES.has(code) ? 'red' : 'yellow', newDesc: null };
  }
}

export async function POST({ request, url }) {
  const recheck     = url.searchParams.get('recheck') === '1';
  const links       = recheck ? getYellowLinks() : getLinksNeedingFetch();
  const total       = links.length;
  const encoder     = new TextEncoder();
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

        if (!recheck || status === 'green') updateLinkStatus(link.id, status, newDesc);

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
