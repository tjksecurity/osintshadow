import { Hono } from 'hono';
import type { Handler } from 'hono/types';
import updatedFetch from '../src/__create/fetch';
import { getHonoPath } from './route-path';

const API_BASENAME = '/api';
const api = new Hono();
const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;
type RouteMethod = typeof methods[number];
type RouteHandler = (request: Request, context: { params: Record<string, string> }) => Response | Promise<Response>;
type RouteModule = Partial<Record<RouteMethod, RouteHandler>>;

if (globalThis.fetch) globalThis.fetch = updatedFetch;

// Vite transforms this registry into bundled imports in both development and production.
// Source files need not be present next to the compiled server, and paths are portable.
const routeModules = import.meta.glob<RouteModule>('../src/app/api/**/route.{js,ts}');
const routeFiles = Object.keys(routeModules).sort((a, b) => b.length - a.length);
for (const routeFile of routeFiles) {
  const route = await routeModules[routeFile]();
  const honoPath = getHonoPath(routeFile);
  for (const method of methods) {
    const routeHandler = route[method];
    if (!routeHandler) continue;
    const handler: Handler = (context) => {
      const missing = ['DATABASE_URL', 'AUTH_SECRET'].filter((name) => !process.env[name]);
      if (missing.length) return context.json({ error: 'Server configuration required.', code: 'CONFIGURATION_REQUIRED', missing }, 503);
      return routeHandler(context.req.raw, { params: context.req.param() });
    };
    api.on(method, honoPath, handler);
  }
}

if (import.meta.hot) {
  import.meta.hot.accept(() => import.meta.hot?.invalidate());
}
export { api, API_BASENAME };
