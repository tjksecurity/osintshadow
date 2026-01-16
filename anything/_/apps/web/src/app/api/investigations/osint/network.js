import { safeFetch, reverseDns } from "./helpers.js";
import { shodanHostIntel } from "./shodan.js";

export async function ipNetworkIntel(ipList, opts = {}) {
  const ips = [];

  const includeShodan =
    opts.includeShodan !== false && !!process.env.SHODAN_API_KEY;

  // Keep Shodan calls bounded to avoid rate/credit blowups.
  const maxShodanLookups = Number.isFinite(Number(opts.maxShodanLookups))
    ? Number(opts.maxShodanLookups)
    : opts.deepScan
      ? 8
      : 3;
  let shodanLookupsUsed = 0;

  for (const ip of ipList) {
    const item = { ip };
    try {
      const r = await safeFetch(
        `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city,lat,lon,isp,org,as,query`,
        {
          headers: { Accept: "application/json" },
          timeoutMs: opts.timeoutMs ?? 9000,
          retries: opts.retries ?? 1,
        },
      );
      const j = r.ok ? await r.json() : null;
      if (j && j.status === "success") {
        item.geo = {
          country: j.country,
          region: j.regionName,
          city: j.city,
          lat: j.lat,
          lon: j.lon,
        };
        item.network = { isp: j.isp, org: j.org, asn: j.as };
        // reverse DNS via PTR lookup
        try {
          const ptr = await reverseDns(ip);
          item.reverse_dns = ptr;
        } catch {}
        // hosting classification heuristic
        const asLower = (j.as || "").toLowerCase();
        item.hosting =
          /amazon|google|digitalocean|azure|ovh|linode|contabo|cloud/i.test(
            asLower,
          )
            ? "datacenter"
            : "residential_or_unknown";
      }

      // NEW: Shodan enrichment (optional)
      if (includeShodan && shodanLookupsUsed < maxShodanLookups) {
        const shodan = await shodanHostIntel(ip, {
          timeoutMs: opts.timeoutMs ?? 12000,
          retries: 1,
        });
        shodanLookupsUsed++;

        if (shodan.ok) {
          item.shodan = {
            found: !!shodan.found,
            host: shodan.found ? shodan.host : null,
          };
        } else {
          item.shodan = {
            found: false,
            error: shodan.error,
          };
        }
      }
    } catch (e) {
      item.error = e.message;
    }
    ips.push(item);
  }

  return {
    ips,
    shodan: includeShodan
      ? {
          enabled: true,
          lookups_used: shodanLookupsUsed,
          lookups_cap: maxShodanLookups,
        }
      : { enabled: false },
  };
}
