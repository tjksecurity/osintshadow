import { safeFetch } from "./helpers.js";

function hasShodanKey() {
  return !!process.env.SHODAN_API_KEY;
}

function redactHostResponse(raw) {
  if (!raw || typeof raw !== "object") return null;

  // Keep only the fields that are useful for investigation + safe to store.
  // Avoid massive payloads and anything that might be too sensitive/noisy.
  const out = {
    ip_str: raw.ip_str || null,
    org: raw.org || null,
    isp: raw.isp || null,
    asn: raw.asn || raw.as || null,
    country_name: raw.country_name || null,
    region_code: raw.region_code || null,
    city: raw.city || null,
    latitude: raw.latitude || null,
    longitude: raw.longitude || null,
    ports: Array.isArray(raw.ports) ? raw.ports.slice(0, 200) : [],
    hostnames: Array.isArray(raw.hostnames) ? raw.hostnames.slice(0, 50) : [],
    domains: Array.isArray(raw.domains) ? raw.domains.slice(0, 50) : [],
    tags: Array.isArray(raw.tags) ? raw.tags.slice(0, 50) : [],
    last_update: raw.last_update || null,
    vulns: null,
    services: [],
  };

  // Vulns can be an object keyed by CVE. Convert to an array of CVE IDs.
  if (raw.vulns && typeof raw.vulns === "object") {
    const cves = Object.keys(raw.vulns);
    out.vulns = cves.slice(0, 200);
  } else if (Array.isArray(raw.vulns)) {
    out.vulns = raw.vulns.slice(0, 200);
  }

  // Data/services is huge; keep a thin summary per service.
  if (Array.isArray(raw.data)) {
    out.services = raw.data.slice(0, 60).map((svc) => {
      const product = svc?.product || null;
      const version = svc?.version || null;
      const transport = svc?.transport || null;
      const port = svc?.port || null;
      const proto = svc?.proto || null;
      const cpe = Array.isArray(svc?.cpe) ? svc.cpe.slice(0, 10) : [];
      const title = svc?.http?.title || null;
      const host = svc?.ssl?.cert?.subject?.CN || null;

      return {
        port,
        transport,
        proto,
        product,
        version,
        cpe,
        http_title: title,
        tls_cn: host,
      };
    });
  }

  return out;
}

export async function shodanHostIntel(ip, opts = {}) {
  if (!hasShodanKey()) {
    return { ok: false, error: "SHODAN_API_KEY not set" };
  }

  const key = process.env.SHODAN_API_KEY;
  const url = `https://api.shodan.io/shodan/host/${encodeURIComponent(ip)}?key=${encodeURIComponent(key)}`;

  try {
    const res = await safeFetch(url, {
      timeoutMs: opts.timeoutMs ?? 12000,
      retries: opts.retries ?? 1,
      headers: {
        Accept: "application/json",
      },
    });

    // Shodan often returns 404 for "no information available"
    if (res.status === 404) {
      return { ok: true, found: false };
    }

    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        error: `Shodan host lookup failed: [${res.status}] ${res.statusText}`,
        details: text.slice(0, 500),
      };
    }

    const json = await res.json();
    return { ok: true, found: true, host: redactHostResponse(json) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export async function shodanDomainIntel(domain, opts = {}) {
  if (!hasShodanKey()) {
    return { ok: false, error: "SHODAN_API_KEY not set" };
  }

  const key = process.env.SHODAN_API_KEY;
  const url = `https://api.shodan.io/dns/domain/${encodeURIComponent(domain)}?key=${encodeURIComponent(key)}`;

  try {
    const res = await safeFetch(url, {
      timeoutMs: opts.timeoutMs ?? 12000,
      retries: opts.retries ?? 1,
      headers: {
        Accept: "application/json",
      },
    });

    if (res.status === 404) {
      return { ok: true, found: false };
    }

    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        error: `Shodan domain lookup failed: [${res.status}] ${res.statusText}`,
        details: text.slice(0, 500),
      };
    }

    const json = await res.json();

    // Keep it small.
    const subdomains = Array.isArray(json.subdomains)
      ? json.subdomains
          .filter(Boolean)
          .slice(0, 500)
          .map((s) => `${s}.${domain}`)
      : [];

    return {
      ok: true,
      found: true,
      domain: {
        domain: json.domain || domain,
        tags: Array.isArray(json.tags) ? json.tags.slice(0, 50) : [],
        subdomains,
      },
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
