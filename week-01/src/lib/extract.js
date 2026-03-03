// Shared HTML extraction helpers used by fetch-descriptions and suggest endpoints.

export function extractMetaDesc(html) {
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

export function extractJsonLdDesc(html) {
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
        if (Array.isArray(item['@graph'])) {
          for (const node of item['@graph']) {
            if (node.description && typeof node.description === 'string' && node.description.length >= 20) {
              return node.description.trim();
            }
          }
        }
      }
    } catch { /* malformed JSON-LD */ }
  }
  return null;
}

function stripTags(s) {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ').trim();
}

export function extractBodyDesc(html) {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '');

  const containers = [
    (cleaned.match(/<main[^>]*>([\s\S]*?)<\/main>/i)       ?? [])[1],
    (cleaned.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ?? [])[1],
    (cleaned.match(/<body[^>]*>([\s\S]*)/i)                ?? [])[1],
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

// Fetch a URL and return extracted description, or null on any failure.
// limit: max bytes to read (64 KB for head-only, 256 KB for body content).
export async function fetchDescription(targetUrl, limit = 65536) {
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    let res;
    try {
      res = await fetch(targetUrl, {
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

    if (!res.ok) return null;

    const reader = res.body.getReader();
    let html = '', bytes = 0;
    while (bytes < limit) {
      const { done, value } = await reader.read();
      if (done) break;
      html  += new TextDecoder().decode(value);
      bytes += value.length;
    }
    reader.cancel();

    return extractMetaDesc(html) ?? extractJsonLdDesc(html) ?? extractBodyDesc(html);
  } catch {
    return null;
  }
}
