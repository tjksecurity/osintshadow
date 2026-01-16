import { dnsResolve, safeFetch } from "./helpers.js";
import { shodanDomainIntel } from "./shodan.js";

export async function domainIntel(domain) {
  const out = {
    domain,
    whois: null,
    dns: null,
    subdomains: [],
    web: null,
    reputation: null,
    shodan: { enabled: !!process.env.SHODAN_API_KEY, found: false },
  };
  try {
    // WHOIS via RDAP
    try {
      const r = await safeFetch(
        `https://rdap.org/domain/${encodeURIComponent(domain)}`,
        { headers: { Accept: "application/json" } },
      );
      if (r.ok) {
        const j = await r.json();
        out.whois = {
          registrar:
            j.entities
              ?.find((e) => e.roles?.includes("registrar"))
              ?.vcardArray?.[1]?.find((x) => x[0] === "fn")?.[3] || null,
          creation_date:
            j.events?.find((e) => e.eventAction === "registration")
              ?.eventDate || null,
          expiration_date:
            j.events?.find((e) => e.eventAction === "expiration")?.eventDate ||
            null,
          name_servers: (j.nameservers || []).map((n) => n.ldhName),
        };
      }
    } catch (e) {
      out.whois = { error: e.message };
    }

    // DNS records
    const [A, AAAA, MX, NS, TXT, CNAME] = await Promise.all([
      dnsResolve(domain, "A"),
      dnsResolve(domain, "AAAA"),
      dnsResolve(domain, "MX"),
      dnsResolve(domain, "NS"),
      dnsResolve(domain, "TXT"),
      dnsResolve(domain, "CNAME"),
    ]);
    const dmarc = await dnsResolve(`_dmarc.${domain}`, "TXT");
    out.dns = { A, AAAA, MX, NS, TXT, CNAME };
    out.spf = {
      has_spf: TXT.some((t) => (t.data || t).toString().includes("v=spf1")),
      record:
        TXT.map((t) => t.data || t).find((x) =>
          x.toString().includes("v=spf1"),
        ) || null,
    };
    out.dmarc = {
      has_dmarc: dmarc.some((t) =>
        (t.data || t).toString().includes("v=DMARC1"),
      ),
      record:
        dmarc
          .map((t) => t.data || t)
          .find((x) => x.toString().includes("v=DMARC1")) || null,
    };

    // Subdomains via crt.sh (passive)
    try {
      const res = await safeFetch(
        `https://crt.sh/?q=%25.${encodeURIComponent(domain)}&output=json`,
        { headers: { Accept: "application/json" } },
      );
      if (res.ok) {
        const rows = await res.json();
        const set = new Set();
        for (const row of rows) {
          const names = String(row.name_value).split("\n");
          for (const n of names) {
            const d = n.trim();
            if (d.endsWith(`.${domain}`) && !d.includes("*"))
              set.add(d.toLowerCase());
          }
        }
        out.subdomains = Array.from(set).slice(0, 200);
      }
    } catch (e) {
      // ignore
    }

    // NEW: Shodan domain enrichment (optional)
    if (process.env.SHODAN_API_KEY) {
      const sh = await shodanDomainIntel(domain, {
        timeoutMs: 12000,
        retries: 1,
      });

      if (sh.ok && sh.found) {
        out.shodan = { enabled: true, found: true, ...sh.domain };
        // Merge Shodan subdomains (dedupe)
        const merged = new Set([
          ...(out.subdomains || []),
          ...(sh.domain.subdomains || []),
        ]);
        out.subdomains = Array.from(merged).slice(0, 300);
      } else if (sh.ok) {
        out.shodan = { enabled: true, found: false };
      } else {
        out.shodan = { enabled: true, found: false, error: sh.error };
      }
    }

    // Light wordlist DNS brute (no HTTP)
    const commonSubs = [
      "www",
      "api",
      "mail",
      "smtp",
      "imap",
      "vpn",
      "dev",
      "staging",
      "cdn",
      "blog",
      "shop",
      "status",
    ];
    for (const s of commonSubs) {
      const fqdn = `${s}.${domain}`;
      const recs = await dnsResolve(fqdn, "A");
      if (recs.length) {
        if (!out.subdomains.includes(fqdn)) out.subdomains.push(fqdn);
      }
    }

    // Web fingerprinting
    out.web = await webFingerprint(domain);

    // Reputation
    out.reputation = await domainReputation(domain);
  } catch (e) {
    out.error = e.message;
  }
  return out;
}

export async function webFingerprint(domain) {
  const out = {
    url: null,
    http: null,
    title: null,
    meta_description: null,
    canonical: null,
    tech: [],
    links: { internal: [], external: [] },
    assets: { images: [], scripts: [], styles: [], documents: [] },
    raw_html: null,
  };
  const urls = [`https://${domain}`, `http://${domain}`];
  for (const url of urls) {
    try {
      const res = await safeFetch(url);
      if (!res.ok) continue;
      out.url = url;
      const html = await res.text();
      out.raw_html = html.slice(0, 500000); // cap
      out.title = (html.match(/<title>([^<]+)<\/title>/i) || [])[1] || null;
      out.meta_description =
        (html.match(
          /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i,
        ) || [])[1] || null;
      out.canonical =
        (html.match(
          /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
        ) || [])[1] || null;
      // links
      const hrefs = Array.from(html.matchAll(/href=["']([^"'#]+)["']/gi)).map(
        (m) => m[1],
      );
      for (const h of hrefs) {
        if (h.startsWith("http")) {
          if (h.includes(domain)) out.links.internal.push(h);
          else out.links.external.push(h);
        } else if (h.startsWith("/")) {
          out.links.internal.push(new URL(h, url).toString());
        }
      }
      // assets
      const img = Array.from(
        html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi),
      ).map((m) => m[1]);
      out.assets.images = img.map((i) =>
        i.startsWith("http") ? i : new URL(i, url).toString(),
      );
      const scripts = Array.from(
        html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi),
      ).map((m) => m[1]);
      out.assets.scripts = scripts.map((s) =>
        s.startsWith("http") ? s : new URL(s, url).toString(),
      );
      const styles = Array.from(
        html.matchAll(
          /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/gi,
        ),
      ).map((m) => m[1]);
      out.assets.styles = styles.map((s) =>
        s.startsWith("http") ? s : new URL(s, url).toString(),
      );
      const docs = hrefs.filter((h) => /\.pdf($|\?)/i.test(h));
      out.assets.documents = docs.map((d) =>
        d.startsWith("http") ? d : new URL(d, url).toString(),
      );
      // tech detection
      const tech = [];
      if (/wp-content|wordpress/i.test(html)) tech.push("WordPress");
      if (
        /cloudflare/i.test(res.headers.get("server") || "") ||
        /cdn-cgi\/trace/i.test(html)
      )
        tech.push("Cloudflare");
      if (/shopify/i.test(html)) tech.push("Shopify");
      if (/wp-json/i.test(html)) tech.push("WP-REST");
      out.tech = tech;
      out.http = { status: res.status };
      break;
    } catch (e) {
      out.error = e.message;
    }
  }
  return out;
}

export async function domainReputation(domain) {
  const rep = { openphish: false, urlhaus: false };
  try {
    const [op, uh] = await Promise.all([
      safeFetch("https://openphish.com/feed.txt"),
      safeFetch("https://urlhaus.abuse.ch/downloads/hostfile/"),
    ]);
    if (op.ok) {
      const t = await op.text();
      rep.openphish = t.includes(domain);
    }
    if (uh.ok) {
      const t = await uh.text();
      rep.urlhaus = t.includes(domain);
    }
  } catch {}
  return rep;
}

export function uniqueIPsFromDomain(domainData) {
  const ips = new Set();
  if (!domainData) return [];
  const addFrom = (arr) =>
    (arr || []).forEach((r) => {
      const s = (r.data || r).toString();
      s.split(" ").forEach((p) => {
        if (/^(\d{1,3}\.){3}\d{1,3}$/.test(p)) ips.add(p);
      });
    });
  if (domainData.dns?.A) addFrom(domainData.dns.A);
  return Array.from(ips);
}
