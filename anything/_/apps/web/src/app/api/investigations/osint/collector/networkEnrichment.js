import { uniqueIPsFromDomain } from "../domain.js";
import { ipNetworkIntel } from "../network.js";
import { documentsIntel } from "../media.js";
import { cryptoIntel, extractCryptoFromHtml } from "../crypto.js";

export async function enrichNetworkData(data) {
  const ipsFromDomain = uniqueIPsFromDomain(data.domain);
  if (ipsFromDomain.length) {
    const net = await ipNetworkIntel(ipsFromDomain, {
      deepScan: data.flags.include_deep_scan,
    });
    data.ip_network.ips = [...(data.ip_network.ips || []), ...net.ips];

    if (net.shodan) {
      data.ip_network.shodan = net.shodan;
    }
  }
}

export async function enrichDomainAssets(data, imageCandidates) {
  if (data.domain?.web?.assets) {
    const { images = [], documents = [] } = data.domain.web.assets;

    const homepage =
      data.domain?.domain_info?.homepage ||
      (data.domain?.domain_info?.domain
        ? `http://${data.domain.domain_info.domain}`
        : null);

    for (const u of images.slice(0, 50)) {
      if (!imageCandidates.has(u))
        imageCandidates.set(u, { url: u, source_url: homepage || u });
    }

    data.documents = await documentsIntel(documents.slice(0, 2));

    const cryptoFound = extractCryptoFromHtml(data.domain?.web?.raw_html || "");
    if (cryptoFound.length) {
      data.crypto = await cryptoIntel(cryptoFound.slice(0, 5));
    }
  }
}
