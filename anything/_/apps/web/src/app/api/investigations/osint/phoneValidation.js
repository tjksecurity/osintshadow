// These checks deliberately establish extraction quality, not ownership. A
// public page can mention a phone number for many reasons, so callers must
// retain the source and present every result as an unverified observation.
const CONTACT_CONTEXT = /(?:phone|telephone|mobile|call|text|sms|whatsapp|contact|tel)\s*[:#-]?\s*$/i;
const PHONE_SHAPE = /(?:\+\d{1,3}[\s().-]?)?(?:\(?\d{2,4}\)?[\s().-]?){2,4}\d{2,4}/g;

function hasObviousPlaceholderDigits(digits) {
  if (/^(\d)\1+$/.test(digits)) return true;

  // A compact ISO-like date followed by a short numeric suffix is a common
  // false positive in page metadata and account identifiers.
  if (/^(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{2,7}$/.test(digits)) {
    return true;
  }

  // For a 10-digit North American-looking value, reject impossible area and
  // exchange prefixes. This is syntactic filtering only, not a carrier check.
  const nanp = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (nanp.length === 10 && (/^[01]/.test(nanp) || /^[01]/.test(nanp.slice(3)))) {
    return true;
  }

  return false;
}

export function normalizePhoneCandidate(value, options = {}) {
  const display = String(value || "").trim();
  const digits = display.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15 || hasObviousPlaceholderDigits(digits)) {
    return null;
  }

  const hasTelLink = options.extraction_method === "tel_link";
  const hasContactContext = CONTACT_CONTEXT.test(String(options.context || ""));
  const hasPhoneFormatting = /\+|\(|\)|[.\-\s]/.test(display);

  // A bare integer is too ambiguous (IDs, timestamps, coordinates, etc.).
  // Accept it only when a tel: link or nearby contact label supplies context.
  if (!options.allow_bare_input && !hasTelLink && !hasContactContext && !hasPhoneFormatting) {
    return null;
  }

  return {
    display,
    digits,
    verification_status: "unverified_candidate",
    extraction_method: hasTelLink
      ? "tel_link"
      : hasContactContext
        ? "contact_context"
        : "formatted_text",
  };
}

export function extractPhoneCandidatesFromHtml(html) {
  if (!html) return [];
  const source = String(html);
  const candidates = [];
  const seen = new Set();
  const add = (value, options) => {
    const candidate = normalizePhoneCandidate(value, options);
    if (!candidate || seen.has(candidate.digits)) return;
    seen.add(candidate.digits);
    candidates.push(candidate);
  };

  // tel: links are explicit contact affordances, but they still do not verify
  // who controls the number or whether it belongs to the investigation target.
  const telLink = /href\s*=\s*(["'])\s*tel:([^"'#?\s]+)\1/gi;
  let match;
  while ((match = telLink.exec(source))) {
    add(decodeURIComponent(match[2]), { extraction_method: "tel_link" });
  }

  const text = source.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const formatted = new RegExp(PHONE_SHAPE.source, "g");
  while ((match = formatted.exec(text))) {
    const before = text.slice(Math.max(0, match.index - 48), match.index);
    add(match[0], { context: before, extraction_method: "page_text" });
  }

  return candidates;
}
