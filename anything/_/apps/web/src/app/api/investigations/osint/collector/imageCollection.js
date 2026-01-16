import { imagesIntel, extractImageUrlsFromHtml } from "../media.js";
import { safeFetch } from "../helpers.js";

async function safePageFetch(url, deepScan = false) {
  return safeFetch(url, {
    timeoutMs: deepScan ? 12000 : 8000,
    retries: deepScan ? 3 : 2,
  });
}

export async function collectImageCandidates(data, imageCandidates) {
  try {
    const pageUrls = new Set();
    for (const p of data.username?.profiles || []) {
      if (p?.profile_url) pageUrls.add(p.profile_url);
    }
    for (const u of data.discovered_urls || []) pageUrls.add(u);

    const FETCH_LIMIT = data.flags.include_deep_image_scan ? 40 : 18;
    const CONCURRENCY = data.flags.include_deep_image_scan ? 5 : 3;
    const urlsToFetch = Array.from(pageUrls).slice(0, FETCH_LIMIT);

    let idx = 0;
    const worker = async () => {
      while (idx < urlsToFetch.length) {
        const url = urlsToFetch[idx];
        idx += 1;
        try {
          const res = await safePageFetch(url, data.flags.include_deep_scan);
          if (!res.ok) continue;
          const html = await res.text();
          const imgs = extractImageUrlsFromHtml(html, url);
          for (const im of imgs) {
            if (!imageCandidates.has(im))
              imageCandidates.set(im, { url: im, source_url: url });
          }
        } catch {
          // non-fatal
        }
      }
    };

    await Promise.allSettled(
      Array.from({
        length: Math.min(CONCURRENCY, Math.max(1, urlsToFetch.length)),
      }).map(() => worker()),
    );
  } catch {}
}

export async function finalizeImageIntel(data, imageCandidates) {
  try {
    const urls = Array.from(imageCandidates.values());
    if (urls.length) {
      const cap = data.flags.include_deep_image_scan ? 180 : 80;
      const limited = urls.slice(0, cap);
      const imgInfo = await imagesIntel(limited);
      data.images = imgInfo;
    }
  } catch (e) {
    data.images = data.images || { items: [] };
    data.images.error = e?.message || "Failed to analyze images";
  }
}
