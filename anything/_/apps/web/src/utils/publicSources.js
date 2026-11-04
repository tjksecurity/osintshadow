// Browser-safe catalogue. Credentials and transport belong in the server adapter.
export const PUBLIC_SOURCES = Object.freeze([
  { id: 'github', label: 'GitHub', targets: ['username', 'name'], detail: 'Public developer accounts' },
  { id: 'bluesky', label: 'Bluesky', targets: ['username'], detail: 'Exact full handle or DID' },
  { id: 'stackexchange', label: 'Stack Exchange', targets: ['username', 'name'], detail: 'Stack Overflow display-name candidates' },
  { id: 'openalex', label: 'OpenAlex', targets: ['name'], detail: 'Researchers and affiliations' },
  { id: 'wikidata', label: 'Wikidata', targets: ['name'], detail: 'Public-person entity candidates' },
  { id: 'tavily', label: 'Tavily', targets: ['name', 'username'], detail: 'Public professional profile discovery' },
  { id: 'exa', label: 'Exa', targets: ['name', 'username'], detail: 'Public professional profile discovery' },
  { id: 'veriphone', label: 'Veriphone', targets: ['phone'], detail: 'Number validation, not owner identification' },
]);

export function normalizePublicSources(value) {
  if (!Array.isArray(value) || value.length > 8 || value.some(id =>
    typeof id !== 'string' || !PUBLIC_SOURCES.some(source => source.id === id))) return [];
  return [...new Set(value)];
}

export function validInvestigationId(value) {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0;
  return typeof value === 'string' && /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n;
}

export const PUBLIC_PROFILE_DOMAINS = Object.freeze([
  'github.com', 'stackoverflow.com', 'bsky.app', 'orcid.org', 'openalex.org', 'wikidata.org', 'linkedin.com',
]);

export function safePublicSourceUrl(value) {
  if (typeof value !== 'string' || value.length > 1000 || /[\x00-\x20\x7f\\]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      !PUBLIC_PROFILE_DOMAINS.some(domain => url.hostname === domain || url.hostname.endsWith('.' + domain))) return null;
    url.search = ''; url.hash = '';
    return url.href;
  } catch { return null; }
}
