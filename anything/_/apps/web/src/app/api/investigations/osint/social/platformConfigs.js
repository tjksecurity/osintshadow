// Platform search configurations (augmented with domains/path hints)
export const PLATFORM_CONFIGS = {
  twitter: {
    domains: ["twitter.com", "x.com"],
    pathHint: /\/([A-Za-z0-9_]{1,30})(?:\/?|\?.*)$/i,
    // NOTE: support name-based discovery via search engines (site: queries)
    searchEndpoints: ["username", "email", "name"],
    rateLimit: 100,
    dataFields: ["followers", "following", "tweets", "bio", "verified"],
  },
  instagram: {
    domains: ["instagram.com"],
    pathHint: /\/([A-Za-z0-9_.]{1,30})(?:\/?|\?.*)$/i,
    searchEndpoints: ["username", "email", "name"],
    rateLimit: 50,
    dataFields: ["followers", "following", "posts", "bio", "verified"],
  },
  linkedin: {
    domains: ["linkedin.com"],
    pathHint: /\/in\/([A-Za-z0-9\-_.]{1,100})/i,
    searchEndpoints: ["username", "email", "phone", "name"],
    rateLimit: 75,
    dataFields: ["connections", "experience", "bio", "company"],
  },
  facebook: {
    domains: ["facebook.com", "m.facebook.com"],
    pathHint: /facebook\.com\/(?:profile\.php\?id=\d+|[A-Za-z0-9.]{3,})/i,
    searchEndpoints: ["username", "email", "phone", "name"],
    rateLimit: 25,
    dataFields: ["friends", "posts", "bio", "location"],
  },
  tiktok: {
    domains: ["tiktok.com"],
    pathHint: /@([A-Za-z0-9_.]{1,30})/i,
    // TikTok doesn't have great name search, but site: discovery works fine.
    searchEndpoints: ["username", "name"],
    rateLimit: 30,
    dataFields: ["followers", "following", "videos", "bio", "verified"],
  },
  youtube: {
    domains: ["youtube.com"],
    pathHint: /\/(?:@([A-Za-z0-9_\-\.]{1,100})|channel\/[A-Za-z0-9_\-]{10,})/i,
    searchEndpoints: ["username", "email", "name"],
    rateLimit: 40,
    dataFields: ["subscribers", "videos", "bio", "verified"],
  },
  reddit: {
    domains: ["reddit.com"],
    pathHint: /\/(?:user|u)\/([A-Za-z0-9_\-]{2,20})/i,
    searchEndpoints: ["username", "name"],
    rateLimit: 60,
    dataFields: ["karma", "posts", "comments", "bio"],
  },
};

// Previous default (0.85) was effectively "always empty" except perfect username matches.
// For OSINT, it's better to return candidates and let the UI/analysis score them.
export const DEFAULT_MIN_CONFIDENCE = 0.35;
export const MAX_RESULTS_PER_PLATFORM = 5;
