// CSRF protection: reject mutations from foreign origins.
//
// Browsers always include the Origin header on cross-origin requests.
// Same-origin fetch/XHR requests do NOT send Origin, so we allow those through.
// This stops cross-site request forgery without requiring session tokens.
export function onRequest({ request }, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return next();
  }

  const origin = request.headers.get('origin');
  if (!origin) return next(); // same-origin — no Origin header sent

  const host  = request.headers.get('host') ?? '';
  const proto = request.headers.get('x-forwarded-proto')
    ?? new URL(request.url).protocol.slice(0, -1); // strip trailing ':'
  if (origin !== `${proto}://${host}`) {
    return new Response('Forbidden', { status: 403 });
  }

  return next();
}
