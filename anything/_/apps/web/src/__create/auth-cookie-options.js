// Cookie naming must agree with trusted deployment configuration. A request's
// Host/forwarded headers never select authentication cookie security.
export function authCookieOptions(env = process.env) {
  const configured = env.AUTH_URL || env.APP_URL;
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.username || url.password || !['http:', 'https:'].includes(url.protocol)) return null;
      if (url.protocol === 'http:') {
        const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
        if (env.NODE_ENV === 'production' || !loopback) return null;
      }
      return { secureCookie: url.protocol === 'https:' };
    } catch {
      return null;
    }
  }
  // Auth.js uses the secure cookie name for the production HTTPS deployment.
  // Development retains the ordinary cookie name for loopback HTTP.
  return { secureCookie: env.NODE_ENV === 'production' };
}
