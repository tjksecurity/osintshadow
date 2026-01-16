export async function dnsResolve(name, type) {
  try {
    const res = await safeFetch(
      `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`,
    );
    if (!res.ok) return [];
    const json = await res.json();
    return json.Answer || [];
  } catch {
    return [];
  }
}

export async function reverseDns(ip) {
  try {
    const parts = ip.split(".").reverse().join(".") + ".in-addr.arpa";
    const r = await dnsResolve(parts, "PTR");
    return r.map((x) => x.data).filter(Boolean)[0] || null;
  } catch {
    return null;
  }
}

// UPDATED: stronger safeFetch with default headers, timeout, and light retries to improve scrape success
export async function safeFetch(url, opts = {}) {
  const defaultHeaders = {
    // mimic a modern desktop browser to reduce basic bot blocking
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    // do not set referer by default
  };

  const timeoutMs = opts.timeoutMs != null ? opts.timeoutMs : 12000;
  const attempts = opts.retries != null ? opts.retries : 2;

  const externalSignal = opts.signal;

  // If an external AbortSignal is already aborted, don't even attempt the request.
  // (This avoids the confusing undici error: "signal is aborted without reason").
  if (externalSignal?.aborted) {
    return new Response("timeout", {
      status: 408,
      statusText: "Request Timeout",
      headers: { "x-shadowtrace-timeout": "1" },
    });
  }

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  let lastErr;

  // Build headers once; other options may be overridden per call.
  const mergedHeaders = { ...defaultHeaders, ...(opts.headers || {}) };

  for (let i = 0; i <= attempts; i++) {
    // IMPORTANT: create a fresh controller per-attempt.
    // If we reuse one controller and it times out, the signal remains aborted,
    // and every retry fails instantly.
    const controller = externalSignal ? null : new AbortController();
    const signal = externalSignal ?? controller.signal;

    let timer = null;
    if (!externalSignal) {
      timer = setTimeout(() => {
        try {
          controller.abort(new Error(`Timeout after ${timeoutMs}ms`));
        } catch {
          controller.abort();
        }
      }, timeoutMs);
    }

    try {
      const res = await fetch(url, {
        ...opts,
        headers: mergedHeaders,
        signal,
        redirect: "follow",
      });

      // Retry on 429/403 with a tiny backoff
      if ((res.status === 429 || res.status === 403) && i < attempts) {
        await delay(400 * (i + 1));
        continue;
      }

      return res;
    } catch (e) {
      lastErr = e;

      const msg = String(e?.message || "");
      const isAbort = e?.name === "AbortError" || msg.includes("aborted");

      // If a request timed out/aborted, return a timeout-like response instead
      // of throwing and killing the whole investigation.
      if (isAbort && i >= attempts) {
        return new Response("timeout", {
          status: 408,
          statusText: "Request Timeout",
          headers: { "x-shadowtrace-timeout": "1" },
        });
      }

      if (i >= attempts) {
        throw e;
      }

      await delay(300 * (i + 1));
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  throw lastErr || new Error("safeFetch failed");
}

function decodeDuckUrl(u) {
  try {
    const url = new URL(u, "https://duckduckgo.com");
    const uddg = url.searchParams.get("uddg");
    return uddg ? decodeURIComponent(uddg) : u;
  } catch {
    return u;
  }
}

export async function searchDuckDuckGo(query, opts = {}) {
  // Use html.duckduckgo.com directly to avoid an extra redirect that sometimes triggers bot/captcha behavior.
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=us-en`;
  try {
    // IMPORTANT: do NOT override the UA with something too generic ("Mozilla/5.0")
    // DDG sometimes serves a different (harder-to-parse) response for that.
    const res = await safeFetch(url, {
      timeoutMs: opts.timeoutMs ?? 12000,
      retries: opts.retries ?? 2,
      headers: {
        // keep the stronger defaults from safeFetch
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!res.ok) return [];
    const html = await res.text();

    const links = [];

    // DDG HTML markup has changed a few times; support multiple patterns.
    // 1) Classic: <a class="result__a" href="...">
    const reClassic =
      /<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/g;
    // 2) Fallback: any link to /l/?uddg=... inside a result block
    const reUddg = /href=["']([^"']+uddg=[^"']+)["']/g;

    let m;
    while ((m = reClassic.exec(html))) {
      links.push(decodeDuckUrl(m[1]));
      if (links.length >= (opts.maxLinks ?? 12)) break;
    }

    if (links.length === 0) {
      while ((m = reUddg.exec(html))) {
        const decoded = decodeDuckUrl(m[1]);
        // avoid internal DDG links that aren't result URLs
        if (decoded.includes("duckduckgo.com")) continue;
        links.push(decoded);
        if (links.length >= (opts.maxLinks ?? 12)) break;
      }
    }

    return links;
  } catch {
    return [];
  }
}
