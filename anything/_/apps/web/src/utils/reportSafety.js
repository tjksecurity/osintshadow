const HTML_ENTITIES = Object.freeze({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
});

export function escapeReportText(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => HTML_ENTITIES[character]);
}

// Reports reference public web sources. Executable/data/protocol-relative URLs
// are kept as inert source text by callers, never made navigable or embedded.
// The UI may also use an explicit app-relative path for an existing PDF export.
export function safeReportUrl(value, { allowRelative = false } = {}) {
  if (typeof value !== 'string') return null;
  const input = value.trim();
  if (!input || /[\u0000-\u001f\u007f\\]/.test(input)) return null;
  if (allowRelative && /^\/(?!\/)/.test(input)) {
    const url = new URL(input, 'https://report.invalid');
    return url.pathname + url.search + url.hash;
  }
  try {
    const url = new URL(input);
    if (url.username || url.password) return null;
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}
