/**
 * Calculate confidence score for profile matches
 */
export function calculateConfidence(profile, targetType, targetValue) {
  let confidence = 0;

  if (targetType === "username") {
    const p = (profile.username || "").toLowerCase();
    const t = (targetValue || "").toLowerCase();
    if (p === t) confidence = 1.0;
    else if (p.includes(t)) confidence = 0.9;
    else if (t.includes(p)) confidence = 0.8;
    else confidence = 0.4;
  } else if (targetType === "email") {
    const emailUsername = (targetValue.split("@")[0] || "").toLowerCase();
    const p = (profile.username || "").toLowerCase();

    if (p === emailUsername) confidence = 0.85;
    else if (p.includes(emailUsername)) confidence = 0.7;
    else confidence = 0.4;

    const desc = (profile.bio || "").toLowerCase();
    if (desc && desc.includes((targetValue || "").toLowerCase())) {
      confidence = Math.min(1.0, confidence + 0.2);
    }
  } else if (targetType === "phone") {
    const desc = (profile.bio || "").replace(/\D/g, "");
    const digits = (targetValue || "").replace(/\D/g, "");
    if (digits && desc.includes(digits)) confidence = 0.9;
    else confidence = 0.3;
  }

  if (profile.profile_image_url) confidence = Math.min(1.0, confidence + 0.05);
  return Math.round(confidence * 100) / 100;
}

/**
 * Generate username variations for email-based searches
 */
export function generateUsernameVariations(username) {
  const variations = new Set();

  // Add original
  variations.add(username);

  // Add with dots
  variations.add(username.replace(/[^a-zA-Z0-9]/g, "."));

  // Add with underscores
  variations.add(username.replace(/[^a-zA-Z0-9]/g, "_"));

  // Add without special characters
  variations.add(username.replace(/[^a-zA-Z0-9]/g, ""));

  // Add common suffixes
  variations.add(username + "1");
  variations.add(username + "123");
  variations.add(username + "official");

  return Array.from(variations);
}
