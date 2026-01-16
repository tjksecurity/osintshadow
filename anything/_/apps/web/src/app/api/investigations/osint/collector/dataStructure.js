export function createOSINTEnvelope(targetType, targetValue, options = {}) {
  return {
    target_type: targetType,
    target_value: targetValue,
    collected_at: new Date().toISOString(),
    email: null,
    username: null,
    phone: null,
    domain: null,
    ip_network: { ips: [] },
    social: { profiles: [] },
    images: { items: [] },
    documents: { items: [] },
    crypto: { items: [] },
    phone_seeds: [],
    email_seeds: [],
    discovered_urls: [],
    records: {
      property_deeds: { items: [], errors: [] },
      court_filings: { items: [], errors: [] },
      criminal: { items: [], errors: [] },
      license_plates: { items: [], errors: [] },
    },
    connections: {
      family: [],
      friends: [],
      associates: [],
    },
    breaches: null,
    mentions: null,
    deep_discovery: null,
    // NOTE: enterprise/paid-source placeholders removed by request.
    flags: {
      include_nsfw:
        options.includeNSFW === undefined ? true : !!options.includeNSFW,
      include_web_scraping:
        options.includeWebScraping === undefined
          ? true
          : !!options.includeWebScraping,
      include_deep_image_scan: !!options.includeDeepImageScan,
      include_deep_scan: !!options.includeDeepScan,
      include_criminal:
        options.includeCriminal === undefined
          ? true
          : !!options.includeCriminal,
      include_court:
        options.includeCourt === undefined ? true : !!options.includeCourt,
      include_property:
        options.includeProperty === undefined
          ? true
          : !!options.includeProperty,
      include_connections:
        options.includeConnections === undefined
          ? true
          : !!options.includeConnections,
      include_license_plate:
        options.includeLicensePlate === undefined
          ? true
          : !!options.includeLicensePlate,
    },
    license_plate: {
      region: options.licensePlateRegion || null,
    },
  };
}

export function createCrossRefs() {
  return {
    phones: [],
    emails: [],
    usernames: [],
    domains: [],
  };
}

export function createProgressReporter(onProgress) {
  if (typeof onProgress !== "function") {
    return () => {};
  }

  return (payload) => {
    try {
      onProgress(payload);
    } catch {
      // ignore
    }
  };
}
