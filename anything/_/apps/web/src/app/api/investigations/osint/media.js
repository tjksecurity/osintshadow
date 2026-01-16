import { digestHex } from "@/app/api/utils/cryptoCompat.js";
import { safeFetch } from "./helpers.js";

export async function imagesIntel(inputs) {
  const items = [];
  const seen = new Set();
  const MIN_SIZE_BYTES = 15000; // ~15KB to filter favicons/sprites

  for (const inp of inputs) {
    const url = typeof inp === "string" ? inp : inp?.url;
    const source_url = typeof inp === "string" ? undefined : inp?.source_url;
    if (!url || seen.has(url)) continue;
    seen.add(url);

    const item = {
      url,
      source_url,
      reverse_search: buildReverseImageSearchUrls(url),
    };

    try {
      const res = await safeFetch(url, { timeoutMs: 8000, retries: 1 });
      if (!res.ok) {
        item.error = `HTTP ${res.status}`;
        items.push(item);
        continue;
      }

      const ct = (res.headers.get("content-type") || "").toLowerCase();
      const len = parseInt(res.headers.get("content-length") || "0", 10) || 0;

      // Filter obvious non-images and SVG/UI assets which often cause false positives
      if (!ct.startsWith("image/") || ct.includes("svg")) {
        item.discarded = true;
        item.discard_reason = !ct.startsWith("image/") ? "non-image" : "svg";
        // Skip adding discarded small assets to UI entirely
        continue;
      }

      // Skip tiny assets (favicons, pixels, sprites)
      if (len > 0 && len < MIN_SIZE_BYTES) {
        item.discarded = true;
        item.discard_reason = "too_small";
        continue;
      }

      const buf = await res.arrayBuffer();
      // Secondary size check after download in case content-length missing
      if (buf.byteLength < MIN_SIZE_BYTES) {
        item.discarded = true;
        item.discard_reason = "too_small";
        continue;
      }

      const exifInfo = parseBasicExif(new Uint8Array(buf));
      item.exif = exifInfo;
      items.push(item);
    } catch (e) {
      item.error = e.message;
      items.push(item);
    }
  }

  return { items };
}

export async function documentsIntel(urls) {
  const items = [];
  for (const url of urls) {
    const item = { url };
    try {
      const res = await safeFetch(url);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        const text = buf.toString("latin1");

        // Hashes are nice-to-have; compute what we can without relying on Node's crypto module.
        try {
          const sha1 = await digestHex("SHA-1", buf);
          const sha256 = await digestHex("SHA-256", buf);
          item.hashes = {
            md5: null, // MD5 isn't supported by WebCrypto; not required for the app to work.
            sha1,
            sha256,
          };
        } catch (e) {
          item.hashes = { md5: null, sha1: null, sha256: null };
          item.hash_error = e?.message || "Failed to compute hashes";
        }

        item.metadata = {
          author: (text.match(/\/Author\s*\(([^)]+)\)/) || [])[1] || null,
          creator: (text.match(/\/Creator\s*\(([^)]+)\)/) || [])[1] || null,
          producer: (text.match(/\/Producer\s*\(([^)]+)\)/) || [])[1] || null,
          creation_date:
            (text.match(/\/CreationDate\s*\(([^)]+)\)/) || [])[1] || null,
        };
        item.outbound_links = Array.from(
          new Set(
            [...text.matchAll(/(https?:\/\/[\w\-\.\/%#?=&:+]+)/gi)].map(
              (m) => m[1],
            ),
          ),
        ).slice(0, 50);
      }
    } catch (e) {
      item.error = e.message;
    }
    items.push(item);
  }
  return { items };
}

export function buildReverseImageSearchUrls(url) {
  return {
    google: `https://www.google.com/searchbyimage?image_url=${encodeURIComponent(url)}`,
    bing: `https://www.bing.com/images/search?q=imgurl:${encodeURIComponent(url)}&view=detailv2&iss=sbi`,
    yandex: `https://yandex.com/images/search?rpt=imageview&url=${encodeURIComponent(url)}`,
  };
}

export function parseBasicExif(buf) {
  // Try to read JPEG EXIF with minimal fields when present
  const out = { has_exif: false };
  if (!(buf && buf.length >= 4)) return out;
  // JPEG header
  if (!(buf[0] === 0xff && buf[1] === 0xd8)) return out;
  let i = 2;
  while (i + 4 < buf.length) {
    if (buf[i] !== 0xff) break;
    const marker = buf[i + 1];
    const size = (buf[i + 2] << 8) + buf[i + 3];
    if (marker === 0xe1) {
      // APP1
      const exifHeader = String.fromCharCode(...buf.slice(i + 4, i + 10));
      if (exifHeader === "Exif\0\0") {
        out.has_exif = true;
        try {
          const tiffBase = i + 10;
          const little =
            buf[tiffBase] === 0x49 && buf[tiffBase + 1] === 0x49 ? true : false;
          const ru16 = (o) =>
            little ? buf[o] + (buf[o + 1] << 8) : (buf[o] << 8) + buf[o + 1];
          const ru32 = (o) =>
            little
              ? buf[o] +
                (buf[o + 1] << 8) +
                (buf[o + 2] << 16) +
                (buf[o + 3] << 24)
              : (buf[o] << 24) +
                (buf[o + 1] << 16) +
                (buf[o + 2] << 8) +
                buf[o + 3];
          const ifd0Offset = tiffBase + ru32(tiffBase + 4);
          const readAscii = (ptr, count) => {
            try {
              const slice = buf.slice(ptr, ptr + count);
              // stop at first null
              let end = slice.indexOf(0);
              if (end === -1) end = slice.length;
              return String.fromCharCode(...slice.slice(0, end)).trim();
            } catch {
              return null;
            }
          };
          function readIFD(at) {
            if (at + 2 > buf.length) return { entries: [], next: 0 };
            const count = ru16(at);
            const entries = [];
            let p = at + 2;
            for (let idx = 0; idx < count; idx++) {
              if (p + 12 > buf.length) break;
              const tag = ru16(p);
              const type = ru16(p + 2);
              const n = ru32(p + 4);
              const valOff = p + 8; // 4 bytes
              let valuePtr = 0;
              let value = null;
              const typeSize =
                type === 1 || type === 2 || type === 7 ? 1 : type === 3 ? 2 : 4;
              const byteCount = n * typeSize;
              if (byteCount <= 4) {
                valuePtr = valOff;
              } else {
                valuePtr = tiffBase + ru32(valOff);
              }
              if (type === 2) {
                value = readAscii(valuePtr, n);
              } else if (type === 3 && n === 1) {
                value = ru16(valuePtr);
              } else if (type === 4 && n === 1) {
                value = ru32(valuePtr) >>> 0;
              }
              entries.push({ tag, type, n, value, valuePtr, byteCount });
              p += 12;
            }
            const next = tiffBase + ru32(p);
            return { entries, next };
          }

          // IFD0
          const { entries: ifd0, next: ifd1Ptr } = readIFD(ifd0Offset);
          const byTag = new Map(ifd0.map((e) => [e.tag, e]));
          const MAKE = 0x010f;
          const MODEL = 0x0110;
          const DATETIME = 0x0132;
          const EXIF_IFD_PTR = 0x8769;
          if (byTag.get(MAKE)?.value) out.make = byTag.get(MAKE).value;
          if (byTag.get(MODEL)?.value) out.model = byTag.get(MODEL).value;
          if (byTag.get(DATETIME)?.value)
            out.date_time = byTag.get(DATETIME).value;

          // EXIF IFD
          const exifPtrEntry = byTag.get(EXIF_IFD_PTR);
          if (exifPtrEntry) {
            const exifAt =
              tiffBase +
              (exifPtrEntry.valuePtr ? ru32(exifPtrEntry.valuePtr) : 0);
            const { entries: exifEntries } = readIFD(exifAt);
            const exByTag = new Map(exifEntries.map((e) => [e.tag, e]));
            const DATETIME_ORIG = 0x9003;
            if (exByTag.get(DATETIME_ORIG)?.value)
              out.date_time_original = exByTag.get(DATETIME_ORIG).value;
          }
        } catch {}
      }
    }
    i += 2 + size;
  }
  return out;
}

// ADD START: lightweight HTML image extractor for photo recovery
export function extractImageUrlsFromHtml(html, baseUrl) {
  if (!html) return [];
  const urls = new Set();

  try {
    // <img src="...">
    const imgRe = /<img[^>]+src\s*=\s*(["'])(.*?)\1/gi;
    let m;
    while ((m = imgRe.exec(html))) {
      const src = (m[2] || "").trim();
      const u = normalizeUrl(src, baseUrl);
      if (u) urls.add(u);
    }

    // Open Graph image
    const ogRe =
      /<meta[^>]+property\s*=\s*["']og:image["'][^>]+content\s*=\s*(["'])(.*?)\1/gi;
    while ((m = ogRe.exec(html))) {
      const src = (m[2] || "").trim();
      const u = normalizeUrl(src, baseUrl);
      if (u) urls.add(u);
    }
  } catch {}

  // Filter obvious non-image or data URIs and keep http(s)
  const out = [];
  for (const u of urls) {
    if (/^data:/i.test(u)) continue;
    if (!/^https?:\/\//i.test(u)) continue;
    if (!/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|#|$)/i.test(u)) {
      // allow OG images without extension
      if (!/og:image/i.test(u)) continue;
    }
    out.push(u);
  }
  return out.slice(0, 200); // safety cap
}

function normalizeUrl(src, baseUrl) {
  try {
    if (!src) return null;
    if (/^https?:\/\//i.test(src)) return src;
    if (src.startsWith("//")) return `https:${src}`;
    if (baseUrl) return new URL(src, baseUrl).toString();
    return null;
  } catch {
    return null;
  }
}
// ADD END
