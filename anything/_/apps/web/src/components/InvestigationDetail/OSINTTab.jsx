import { JSONViewer } from "./JSONViewer";

export function OSINTTab({ osint }) {
  // Safeguards
  const safeOsint = osint || {};
  const isPhoneTarget =
    (safeOsint?.target_type || "").toLowerCase() === "phone";

  // Helper to strip digits for phone comparisons
  const digitsOnly = (v) => String(v || "").replace(/\D/g, "");

  // ----------------------------
  // Shodan UI helpers
  // ----------------------------
  const ipItems = Array.isArray(safeOsint?.ip_network?.ips)
    ? safeOsint.ip_network.ips.filter(Boolean)
    : [];

  const showShodanBlock = ipItems.length > 0;

  const shodanHosts = ipItems
    .filter((it) => it?.shodan?.found && it?.shodan?.host)
    .map((it) => ({ ip: it.ip, host: it.shodan.host }));

  const shodanIpListText = shodanHosts.length
    ? shodanHosts.map((h) => h.ip).join(", ")
    : ipItems
        .map((h) => h.ip)
        .filter(Boolean)
        .join(", ");

  const shodanLookupsUsed = safeOsint?.ip_network?.shodan?.lookups_used || 0;
  const shodanLookupText = shodanLookupsUsed
    ? ` • ${shodanLookupsUsed} lookup(s) used`
    : "";

  const openPorts = Array.from(
    new Set(
      shodanHosts
        .flatMap((h) => (Array.isArray(h.host?.ports) ? h.host.ports : []))
        .filter((p) => Number.isFinite(Number(p)))
        .map((p) => Number(p)),
    ),
  ).sort((a, b) => a - b);

  const knownVulns = Array.from(
    new Set(
      shodanHosts
        .flatMap((h) => (Array.isArray(h.host?.vulns) ? h.host.vulns : []))
        .filter(Boolean)
        .map((v) => String(v).trim())
        .filter(Boolean),
    ),
  ).sort();

  const serviceFingerprints = shodanHosts
    .flatMap((h) => {
      const services = Array.isArray(h.host?.services) ? h.host.services : [];
      return services.map((svc) => ({ ip: h.ip, ...svc }));
    })
    .filter(
      (svc) => svc?.port || svc?.product || svc?.http_title || svc?.tls_cn,
    )
    .slice(0, 60);

  const formatServiceLabel = (svc) => {
    const parts = [];
    const portPart = svc?.port ? String(svc.port) : null;
    const protoPart = svc?.proto ? String(svc.proto) : null;
    const transportPart = svc?.transport ? String(svc.transport) : null;
    const productPart = svc?.product ? String(svc.product) : null;
    const versionPart = svc?.version ? String(svc.version) : null;

    if (portPart) parts.push(portPart);
    if (protoPart) parts.push(protoPart);
    if (transportPart) parts.push(transportPart);

    const left = parts.length ? parts.join("/") : "Service";

    const prod = productPart
      ? versionPart
        ? `${productPart} ${versionPart}`
        : productPart
      : null;

    return prod ? `${left} — ${prod}` : left;
  };

  // Emails found near or related to this number (seeded from web pages)
  const emailSeeds = Array.from(
    new Set(
      (safeOsint?.email_seeds || [])
        .map((e) => (typeof e === "string" ? e : e?.email))
        .filter(Boolean),
    ),
  ).slice(0, 50);

  // Pages mentioning this number (from reverse web scan)
  const phoneWebItems = (safeOsint?.phone?.web?.items || []).slice(0, 20);
  const discoveredUrls = (safeOsint?.discovered_urls || []).slice(0, 50);
  const pagesMentioning = phoneWebItems.length
    ? phoneWebItems
    : discoveredUrls.map((u) => ({ url: u, title: null, snippet: null }));

  // Profiles associated with this number (evidence-backed)
  const targetDigits = digitsOnly(
    safeOsint?.phone?.normalized || safeOsint?.target_value || "",
  );
  const profileCandidates = (safeOsint?.username?.profiles || []).filter(
    Boolean,
  );
  const profilesWithPhoneEvidence = profileCandidates
    .filter((p) => {
      const phones = (p?.match_evidence?.phones || []).map(digitsOnly);
      if (!phones.length) return false;
      if (!targetDigits) return phones.length > 0; // fallback: any phone evidence
      return phones.some((ph) => ph && ph === targetDigits);
    })
    .slice(0, 50);

  // NEW: Breaches summary (HIBP + open web)
  const hibpItems = (safeOsint?.breaches?.hibp?.items || []).slice(0, 10);
  const openWebBreaches = (safeOsint?.breaches?.open_web?.items || []).slice(
    0,
    10,
  );

  // NEW: Mentions (social + web)
  const socialMentions = (safeOsint?.mentions?.social?.items || []).slice(
    0,
    12,
  );
  const webMentions = (safeOsint?.mentions?.web?.items || []).slice(0, 12);

  // NEW: Deep discovery aggregates
  const deepEmails = (safeOsint?.deep_discovery?.aggregate?.emails || []).slice(
    0,
    30,
  );
  const deepPhones = (safeOsint?.deep_discovery?.aggregate?.phones || []).slice(
    0,
    30,
  );

  return (
    <section className="bg-[#2D384E] rounded-lg p-4 overflow-auto">
      <h3 className="font-semibold mb-3">OSINT Data</h3>

      {/* Phone-focused context */}
      {isPhoneTarget && (
        <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Emails near this number */}
          <div className="border border-[#37425B] rounded-lg p-3">
            <div className="text-sm font-semibold mb-2">
              Emails found near this number
            </div>
            {emailSeeds.length === 0 ? (
              <div className="text-slate-400 text-sm">None detected yet.</div>
            ) : (
              <ul className="space-y-1 max-h-56 overflow-auto pr-1">
                {emailSeeds.map((em) => (
                  <li key={em} className="text-sm">
                    <a
                      href={`mailto:${em}`}
                      className="text-[#00D1FF] hover:underline"
                    >
                      {em}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Pages mentioning this number */}
          <div className="border border-[#37425B] rounded-lg p-3">
            <div className="text-sm font-semibold mb-2">
              Pages mentioning this number
            </div>
            {pagesMentioning.length === 0 ? (
              <div className="text-slate-400 text-sm">None detected yet.</div>
            ) : (
              <ul className="space-y-2 max-h-56 overflow-auto pr-1">
                {pagesMentioning.map((item, idx) => (
                  <li key={idx} className="text-sm">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#00D1FF] hover:underline break-all"
                    >
                      {item.title || item.url}
                    </a>
                    {item.snippet && (
                      <div className="text-xs text-slate-400 line-clamp-3">
                        {item.snippet}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Profiles associated with this number */}
          <div className="border border-[#37425B] rounded-lg p-3">
            <div className="text-sm font-semibold mb-2">
              Profiles associated with this number
            </div>
            {profilesWithPhoneEvidence.length === 0 ? (
              <div className="text-slate-400 text-sm">None detected yet.</div>
            ) : (
              <ul className="space-y-2 max-h-56 overflow-auto pr-1">
                {profilesWithPhoneEvidence.map((p, idx) => (
                  <li key={idx} className="text-sm">
                    <a
                      href={p.profile_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#00D1FF] hover:underline"
                    >
                      {p.platform || "Profile"}
                    </a>
                    {p.username && (
                      <span className="text-slate-400"> — {p.username}</span>
                    )}
                    {/* Evidence preview */}
                    {Array.isArray(p?.match_evidence?.phones) &&
                      p.match_evidence.phones.length > 0 && (
                        <div className="text-xs text-slate-400">
                          Mentions this number on page
                        </div>
                      )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* NEW: Breaches + Mentions + Deep discovery cards */}
      {(hibpItems.length > 0 ||
        openWebBreaches.length > 0 ||
        socialMentions.length > 0 ||
        webMentions.length > 0 ||
        deepEmails.length > 0 ||
        deepPhones.length > 0) && (
        <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Data Breaches */}
          <div className="border border-[#37425B] rounded-lg p-3">
            <div className="text-sm font-semibold mb-2">Data breaches</div>
            {hibpItems.length === 0 && openWebBreaches.length === 0 ? (
              <div className="text-slate-400 text-sm">None detected.</div>
            ) : (
              <ul className="space-y-2 max-h-56 overflow-auto pr-1">
                {hibpItems.map((b, idx) => (
                  <li key={`hibp-${idx}`} className="text-sm">
                    <div className="font-medium">{b.name}</div>
                    <div className="text-xs text-slate-400">
                      {b.domain || "Unknown domain"} • {b.breach_date}
                    </div>
                    {Array.isArray(b.data_classes) &&
                      b.data_classes.length > 0 && (
                        <div className="text-xs text-slate-400 truncate">
                          {b.data_classes.join(", ")}
                        </div>
                      )}
                  </li>
                ))}
                {openWebBreaches.map((w, idx) => (
                  <li key={`web-${idx}`} className="text-sm">
                    <a
                      href={w.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#00D1FF] hover:underline break-all"
                    >
                      {w.title || w.url}
                    </a>
                    {w.snippet && (
                      <div className="text-xs text-slate-400 line-clamp-3">
                        {w.snippet}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Online mentions (social first) */}
          <div className="border border-[#37425B] rounded-lg p-3">
            <div className="text-sm font-semibold mb-2">Mentions (social)</div>
            {socialMentions.length === 0 ? (
              <div className="text-slate-400 text-sm">None found.</div>
            ) : (
              <ul className="space-y-2 max-h-56 overflow-auto pr-1">
                {socialMentions.map((m, idx) => (
                  <li key={`soc-${idx}`} className="text-sm">
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#00D1FF] hover:underline break-all"
                    >
                      {m.title || m.url}
                    </a>
                    {m.snippet && (
                      <div className="text-xs text-slate-400 line-clamp-3">
                        {m.snippet}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Deep web discovery (emails/phones) */}
          <div className="border border-[#37425B] rounded-lg p-3">
            <div className="text-sm font-semibold mb-2">Deep web finds</div>
            {deepEmails.length === 0 && deepPhones.length === 0 ? (
              <div className="text-slate-400 text-sm">None harvested.</div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs uppercase text-slate-400 mb-1">
                    Emails
                  </div>
                  <ul className="space-y-1 max-h-40 overflow-auto pr-1">
                    {deepEmails.map((em) => (
                      <li key={`dem-${em}`} className="text-sm break-all">
                        <a
                          href={`mailto:${em}`}
                          className="text-[#00D1FF] hover:underline"
                        >
                          {em}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-xs uppercase text-slate-400 mb-1">
                    Phones
                  </div>
                  <ul className="space-y-1 max-h-40 overflow-auto pr-1">
                    {deepPhones.map((ph) => (
                      <li key={`dph-${ph}`} className="text-sm break-all">
                        {ph}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Shodan block (shows when we have IPs; renders empty-state if no Shodan data yet) */}
      {showShodanBlock && (
        <div className="mb-4 border border-[#37425B] rounded-lg p-3">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <div className="text-sm font-semibold">Shodan network intel</div>
              <div className="text-xs text-slate-400">
                {shodanHosts.length} host(s) enriched{shodanLookupText}
              </div>
            </div>
            <div className="text-xs text-slate-400 break-all">
              {shodanIpListText}
            </div>
          </div>

          {shodanHosts.length === 0 ? (
            <div className="text-slate-400 text-sm">
              No Shodan results yet. Add a{" "}
              <span className="text-slate-200">SHODAN_API_KEY</span> secret and
              rerun the investigation.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Open ports */}
              <div className="border border-[#37425B] rounded-lg p-3">
                <div className="text-sm font-semibold mb-2">Open ports</div>
                {openPorts.length === 0 ? (
                  <div className="text-slate-400 text-sm">None reported.</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {openPorts.slice(0, 60).map((p) => (
                      <span
                        key={p}
                        className="px-2 py-1 rounded bg-[#1F2937] border border-[#37425B] text-xs"
                      >
                        {p}
                      </span>
                    ))}
                    {openPorts.length > 60 && (
                      <span className="text-xs text-slate-400">
                        +{openPorts.length - 60} more
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Known vulns */}
              <div className="border border-[#37425B] rounded-lg p-3">
                <div className="text-sm font-semibold mb-2">Known vulns</div>
                {knownVulns.length === 0 ? (
                  <div className="text-slate-400 text-sm">None reported.</div>
                ) : (
                  <ul className="space-y-1 max-h-56 overflow-auto pr-1">
                    {knownVulns.slice(0, 80).map((cve) => (
                      <li key={cve} className="text-sm">
                        <a
                          href={`https://nvd.nist.gov/vuln/detail/${encodeURIComponent(cve)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#00D1FF] hover:underline break-all"
                        >
                          {cve}
                        </a>
                      </li>
                    ))}
                    {knownVulns.length > 80 && (
                      <li className="text-xs text-slate-400">
                        +{knownVulns.length - 80} more
                      </li>
                    )}
                  </ul>
                )}
              </div>

              {/* Service fingerprints */}
              <div className="border border-[#37425B] rounded-lg p-3">
                <div className="text-sm font-semibold mb-2">
                  Service fingerprints
                </div>
                {serviceFingerprints.length === 0 ? (
                  <div className="text-slate-400 text-sm">None reported.</div>
                ) : (
                  <ul className="space-y-2 max-h-56 overflow-auto pr-1">
                    {serviceFingerprints.map((svc, idx) => {
                      const label = formatServiceLabel(svc);
                      const title = svc?.http_title
                        ? String(svc.http_title)
                        : null;
                      const tls = svc?.tls_cn ? String(svc.tls_cn) : null;
                      const ip = svc?.ip ? String(svc.ip) : null;
                      const cpeList = Array.isArray(svc?.cpe) ? svc.cpe : [];
                      const cpeText = cpeList.length
                        ? cpeList.join(", ")
                        : null;

                      return (
                        <li key={`${ip || "ip"}-${idx}`} className="text-sm">
                          <div className="font-medium">
                            {label}
                            {ip ? (
                              <span className="text-slate-400"> • {ip}</span>
                            ) : null}
                          </div>
                          {title ? (
                            <div className="text-xs text-slate-400">
                              HTTP title: {title}
                            </div>
                          ) : null}
                          {tls ? (
                            <div className="text-xs text-slate-400">
                              TLS CN: {tls}
                            </div>
                          ) : null}
                          {cpeText ? (
                            <div className="text-xs text-slate-400 line-clamp-2">
                              CPE: {cpeText}
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.keys(safeOsint).length === 0 && (
          <div className="text-slate-300">No OSINT data yet.</div>
        )}
        {Object.entries(safeOsint).map(([key, value]) => (
          <div key={key} className="border border-[#37425B] rounded-lg p-3">
            <div className="text-sm font-semibold mb-2 capitalize">{key}</div>
            <JSONViewer data={value} />
          </div>
        ))}
      </div>
    </section>
  );
}
