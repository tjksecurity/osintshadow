const PREFIX = '../src/app/api/';

export function getHonoPath(routeFile: string): string {
  const normalized = routeFile.replaceAll('\\', '/');
  if (!normalized.startsWith(PREFIX) || !/\/route\.(js|ts)$/.test(normalized)) {
    throw new Error(`Invalid API route module path: ${routeFile}`);
  }
  const parts = normalized.slice(PREFIX.length).split('/').slice(0, -1);
  return '/' + parts.map((segment) => {
    const match = segment.match(/^\[(\.{3})?([^\]]+)\]$/);
    return match ? match[1] ? `:${match[2]}{.+}` : `:${match[2]}` : segment;
  }).join('/');
}
