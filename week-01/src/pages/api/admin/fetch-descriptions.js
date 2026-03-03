import { getLinksNeedingFetch, updateLinkStatus } from '../../../lib/db.js';

const LAN_RE = /^https?:\/\/(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)/i;

// HTTP statuses that definitively mean "this URL is dead / gone"
const DEAD_STATUSES = new Set([404, 410]);

// Node.js fetch error codes indicating the host is unreachable
const DEAD_CODES = new Set(['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT']);

function extractMetaDesc(html) {
  const patterns = [
    // name="description" content="..."
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"'<>]{10,})/i,
    /<meta[^>]+content=["']([^"'<>]{10,})["'][^>]+name=["']description["']/i,
    // og:description
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"'<>]{10,})/i,
    /<meta[^>]+content=["']([^"'<>]{10,})["'][^>]+property=["']og:description["']/i,
    // twitter:description
    /<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"'<>]{10,})/i,
    /<meta[^>]+content=["']([^"'<>]{10,})["'][^>]+name=["']twitter:description["']/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

export async function POST({ request }) {
  const encoder = new TextEncoder();
  const abortSignal = request.signal;

  const links = getLinksNeedingFetch();
  const total = links.length;

  const stream = new ReadableStream({
    async start(controller) {
      function send(data) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { /* client disconnected */ }
      }

      send({ type: 'start', total });

      let done = 0, green = 0, yellow = 0, red = 0, blue = 0;

      for (const link of links) {
        if (abortSignal?.aborted) break;

        done++;
        let status;
        let newDesc = null;

        if (LAN_RE.test(link.url)) {
          status = 'blue';
          blue++;
        } else {
          try {
            const ctrl = new AbortController();
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

            if (DEAD_STATUSES.has(res.status)) {
              status = 'red';
              red++;
            } else {
              // Read only the first 64 KB — enough for <head>
              const reader = res.body.getReader();
              let html = '';
              let bytes = 0;
              while (bytes < 65536) {
                const { done: rdone, value } = await reader.read();
                if (rdone) break;
                html += new TextDecoder().decode(value);
                bytes += value.length;
              }
              reader.cancel();

              const desc = extractMetaDesc(html);
              if (desc) {
                status = 'green';
                green++;
                const existing = link.description?.trim();
                newDesc = existing ? `${existing} — ${desc}` : desc;
              } else {
                status = 'yellow';
                yellow++;
              }
            }
          } catch (err) {
            if (DEAD_CODES.has(err?.cause?.code ?? err?.code)) {
              status = 'red';
              red++;
            } else {
              // Timeout (AbortError), 403, CORS, etc. — alive but inaccessible
              status = 'yellow';
              yellow++;
            }
          }
        }

        updateLinkStatus(link.id, status, newDesc);
        send({ type: 'progress', done, total, id: link.id, name: link.name, status });

        // Pause between requests to avoid hammering servers
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
