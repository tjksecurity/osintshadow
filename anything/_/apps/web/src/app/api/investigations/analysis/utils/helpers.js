export const uniq = (arr) => Array.from(new Set((arr || []).filter(Boolean)));
export const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);
export const sum = (arr) =>
  (arr || []).reduce((a, b) => a + (Number(b) || 0), 0);
export const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
