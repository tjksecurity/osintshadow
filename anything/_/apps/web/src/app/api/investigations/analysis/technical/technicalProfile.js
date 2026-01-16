import { uniq, asArray } from "../utils/helpers.js";

export function buildTechnicalProfile(domainInfo, ipNetInfo, emailDomain) {
  const techSignals = asArray(domainInfo?.tech_signals);
  const subdomains = (domainInfo?.subdomains || []).map((s) =>
    typeof s === "string" ? { host: s } : s,
  );
  const hostingKinds = uniq([
    ...(ipNetInfo?.ips || [])
      .map((i) => i?.hosting?.classification)
      .filter(Boolean),
  ]);

  return {
    primary_domain: domainInfo?.domain_info?.domain || emailDomain || null,
    subdomain_count: subdomains.length,
    hosting: hostingKinds,
    tech_stack: techSignals,
  };
}
