import { md5Hex } from "@/app/api/utils/cryptoCompat.js";
import { dnsResolve, safeFetch } from "./helpers.js";

export async function emailIntel(email) {
  const out = { address: email };
  try {
    const domain = email.split("@")[1]?.toLowerCase();
    out.domain = domain || null;
    // Basic format
    out.validation = { format_valid: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) };
    // MX records
    out.mx_records = await dnsResolve(domain, "MX");
    // TXT for SPF
    const txt = await dnsResolve(domain, "TXT");
    const dmarc = await dnsResolve(`_dmarc.${domain}`, "TXT");
    out.spf = {
      has_spf: txt.some((t) => (t.data || t).toString().includes("v=spf1")),
      record:
        txt
          .map((t) => t.data || t)
          .find((x) => x.toString().includes("v=spf1")) || null,
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
    // DKIM heuristic: any TXT with v=DKIM1 at base domain
    out.dkim = {
      has_dkim: txt.some((t) => (t.data || t).toString().includes("v=DKIM1")),
    };
    // Disposable check (curated minimal list + heuristic)
    const disposableDomains = new Set([
      "10minutemail.com",
      "tempmail.org",
      "guerrillamail.com",
      "trashmail.com",
      "mailinator.com",
      "dispostable.com",
      "yopmail.com",
    ]);
    out.is_disposable = disposableDomains.has(domain || "");
    // Gravatar
    try {
      const hash = md5Hex(email.trim().toLowerCase());
      const avatar = `https://www.gravatar.com/avatar/${hash}?d=404`;
      const profileUrl = `https://www.gravatar.com/${hash}.json`;
      const profRes = await safeFetch(profileUrl);
      let profile = null;
      if (profRes.ok) {
        profile = await profRes.json();
      }
      out.gravatar = {
        avatar_url: avatar,
        profile_url: profileUrl,
        exists: profRes.ok,
        profile,
      };
    } catch (e) {
      out.gravatar = { error: e.message };
    }
    // Derived usernames
    out.derived_usernames = deriveUsernames(email);
    // Optional breach signal (HIBP if configured)
    if (process.env.HIBP_API_KEY) {
      try {
        const hibpRes = await fetch(
          `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=true`,
          {
            headers: {
              "hibp-api-key": process.env.HIBP_API_KEY,
              "user-agent": "ShadowTrace/1.0",
            },
          },
        );
        if (hibpRes.status === 200) {
          const breaches = await hibpRes.json();
          out.breach = {
            breach_count: breaches.length,
            breached_domains: [...new Set(breaches.map((b) => b.Domain))].slice(
              0,
              50,
            ),
            first_breach_date:
              breaches.map((b) => b.BreachDate).sort()[0] || null,
          };
        } else if (hibpRes.status === 404) {
          out.breach = {
            breach_count: 0,
            breached_domains: [],
            first_breach_date: null,
          };
        }
      } catch (e) {
        out.breach = { error: e.message };
      }
    }
  } catch (e) {
    out.error = e.message;
  }
  return out;
}

export function deriveUsernames(email) {
  const [local] = email.split("@");
  const parts = local.split(/[._-]/).filter(Boolean);
  const set = new Set();
  if (local) set.add(local);
  if (parts.length >= 2) {
    const [first, last] = parts;
    set.add(`${first}${last}`);
    set.add(`${first}.${last}`);
    set.add(`${first[0]}${last}`);
    set.add(`${first}${last[0]}`);
  }
  set.add(local.replace(/[._-]/g, ""));
  return Array.from(set);
}
