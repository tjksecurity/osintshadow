/**
 * Extract mentions from text
 */
export function extractMentions(text) {
  if (!text) return [];
  const mentions = text.match(/@[\w]+/g);
  return mentions ? mentions.map((m) => m.substring(1)) : [];
}

/**
 * Extract hashtags from text
 */
export function extractHashtags(text) {
  if (!text) return [];
  const hashtags = text.match(/#[\w]+/g);
  return hashtags ? hashtags.map((h) => h.substring(1)) : [];
}
