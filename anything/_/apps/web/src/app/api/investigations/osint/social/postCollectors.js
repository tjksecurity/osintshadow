import { safeFetch } from "../helpers.js";

// ShadowTrace policy: do not generate synthetic/mock social posts.
// This file only collects from sources that have safe, public endpoints.

function extractMentions(text) {
  const out = new Set();
  if (!text) return [];
  const re = /@([a-zA-Z0-9_]{2,30})/g;
  let m;
  while ((m = re.exec(text))) {
    out.add(m[1]);
  }
  // Reddit style: u/username
  const reReddit = /u\/([a-zA-Z0-9_-]{2,30})/g;
  while ((m = reReddit.exec(text))) {
    out.add(m[1]);
  }
  return Array.from(out).slice(0, 25);
}

function extractHashtags(text) {
  const out = new Set();
  if (!text) return [];
  const re = /#([a-zA-Z0-9_]{2,50})/g;
  let m;
  while ((m = re.exec(text))) {
    out.add(m[1]);
  }
  return Array.from(out).slice(0, 25);
}

async function fetchReddit(username, maxPosts) {
  const u = String(username || "").trim();
  if (!u) return [];

  const limit = Math.min(25, Math.max(1, Number(maxPosts) || 10));
  const url = `https://www.reddit.com/user/${encodeURIComponent(u)}.json?limit=${limit}`;

  const res = await safeFetch(url, {
    timeoutMs: 9000,
    retries: 1,
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    return [];
  }

  const json = await res.json().catch(() => null);
  const children = Array.isArray(json?.data?.children)
    ? json.data.children
    : [];

  const posts = [];
  for (const child of children) {
    const d = child?.data;
    if (!d) continue;

    const isComment = d?.name?.startsWith("t1_");
    const text = isComment
      ? d?.body
      : [d?.title, d?.selftext].filter(Boolean).join("\n\n");

    const postedAt = d?.created_utc
      ? new Date(d.created_utc * 1000).toISOString()
      : new Date().toISOString();

    posts.push({
      post_id: d?.name || d?.id,
      content: text || null,
      post_type: isComment ? "comment" : "post",
      posted_at: postedAt,
      engagement_score: Number(d?.ups || 0) + Number(d?.num_comments || 0),
      location_data: null,
      mentions: extractMentions(text),
      hashtags: extractHashtags(text),
      media_urls: d?.url ? [d.url] : null,
      sentiment_score: null,
      source_url: d?.permalink ? `https://www.reddit.com${d.permalink}` : null,
    });
  }

  return posts;
}

async function fetchGitHub(username, maxPosts) {
  const u = String(username || "").trim();
  if (!u) return [];

  const limit = Math.min(30, Math.max(1, Number(maxPosts) || 10));
  const url = `https://api.github.com/users/${encodeURIComponent(u)}/events/public?per_page=${limit}`;

  const res = await safeFetch(url, {
    timeoutMs: 9000,
    retries: 1,
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "ShadowTrace",
    },
  });

  if (!res.ok) {
    return [];
  }

  const events = await res.json().catch(() => null);
  const arr = Array.isArray(events) ? events : [];

  return arr.slice(0, limit).map((ev) => {
    const repo = ev?.repo?.name || null;
    const type = ev?.type || "Event";
    const created = ev?.created_at || new Date().toISOString();

    const content = repo ? `${type} — ${repo}` : type;

    return {
      post_id: String(ev?.id || `${type}_${created}`),
      content,
      post_type: "event",
      posted_at: created,
      engagement_score: 0,
      location_data: null,
      mentions: [],
      hashtags: [],
      media_urls: repo ? [`https://github.com/${repo}`] : null,
      sentiment_score: null,
      source_url: repo ? `https://github.com/${repo}` : null,
    };
  });
}

/**
 * Collect posts for a specific profile.
 * Returns normalized post objects for storage.
 */
export async function collectPostsForProfile(profile, flags = {}) {
  const platform = String(profile?.platform || "").toLowerCase();
  const username = profile?.username;
  const maxPosts = Math.min(
    50,
    Math.max(1, Number(flags?.maxPostsPerProfile) || 10),
  );

  if (!platform || !username) {
    return [];
  }

  try {
    if (platform === "reddit") {
      return await fetchReddit(username, maxPosts);
    }

    if (platform === "github") {
      return await fetchGitHub(username, maxPosts);
    }

    // All other platforms require official APIs or compliant sources.
    return [];
  } catch (e) {
    console.warn("collectPostsForProfile failed", e);
    return [];
  }
}

// Keep exports so other code can import safely.
export async function collectTwitterPosts(username, maxPosts) {
  return [];
}

export async function collectInstagramPosts(username, maxPosts) {
  return [];
}

export async function collectLinkedInPosts(username, maxPosts) {
  return [];
}

export async function collectFacebookPosts(username, maxPosts) {
  return [];
}

export async function collectTikTokPosts(username, maxPosts) {
  return [];
}

export async function collectRedditPosts(username, maxPosts) {
  return fetchReddit(username, maxPosts);
}

export async function collectGitHubEvents(username, maxPosts) {
  return fetchGitHub(username, maxPosts);
}
