import React, { useMemo, useState } from "react";
import {
  MessageSquare,
  Clock,
  MapPin,
  Hash,
  AtSign,
  AlertTriangle,
  BarChart,
  Search,
  Filter,
} from "lucide-react";

export default function SocialPostsTab({ investigation }) {
  const [selectedPlatform, setSelectedPlatform] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showSuspiciousOnly, setShowSuspiciousOnly] = useState(false);

  const rawSource = Array.isArray(investigation?.osint_raw)
    ? investigation.osint_raw
    : Array.isArray(investigation?.osint_data)
      ? investigation.osint_data
      : [];

  const postsData = rawSource.find(
    (item) => item?.data_json?.type === "social_posts_analytics",
  )?.data_json;

  const analytics = postsData?.analytics || {};
  const suspiciousPatterns = Array.isArray(postsData?.suspicious_patterns)
    ? postsData.suspicious_patterns
    : [];

  const posts = Array.isArray(postsData?.posts) ? postsData.posts : [];

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Unknown date";
    }
  };

  const getPlatformPillClass = (platform) => {
    const p = String(platform || "").toLowerCase();
    const base = "px-2 py-1 rounded text-xs font-medium border";

    switch (p) {
      case "twitter":
      case "x":
        return `${base} bg-blue-500/10 border-blue-500/20 text-blue-200`;
      case "instagram":
        return `${base} bg-pink-500/10 border-pink-500/20 text-pink-200`;
      case "linkedin":
        return `${base} bg-indigo-500/10 border-indigo-500/20 text-indigo-200`;
      case "tiktok":
        return `${base} bg-purple-500/10 border-purple-500/20 text-purple-200`;
      case "facebook":
        return `${base} bg-blue-500/10 border-blue-500/20 text-blue-200`;
      case "reddit":
        return `${base} bg-orange-500/10 border-orange-500/20 text-orange-200`;
      default:
        return `${base} bg-[#303B52] border-[#37425B] text-slate-200`;
    }
  };

  const getSentimentPill = (score) => {
    if (typeof score !== "number") return null;
    const base = "px-2 py-1 rounded text-xs font-medium border";
    if (score > 0.3)
      return {
        label: "Positive",
        className: `${base} text-green-200 bg-green-500/10 border-green-500/20`,
      };
    if (score < -0.3)
      return {
        label: "Negative",
        className: `${base} text-red-200 bg-red-500/10 border-red-500/20`,
      };
    return {
      label: "Neutral",
      className: `${base} text-slate-200 bg-[#263043] border-[#37425B]`,
    };
  };

  const getPatternSeverityClass = (severity) => {
    switch (severity) {
      case "high":
        return "bg-red-500/10 border-red-500/20 text-red-200";
      case "medium":
        return "bg-yellow-500/10 border-yellow-500/20 text-yellow-200";
      case "low":
        return "bg-blue-500/10 border-blue-500/20 text-blue-200";
      default:
        return "bg-[#263043] border-[#37425B] text-slate-200";
    }
  };

  const isNightPost = (postedAt) => {
    try {
      const hour = new Date(postedAt).getHours();
      return hour >= 23 || hour <= 5;
    } catch {
      return false;
    }
  };

  const hasRepeatedHashtags = (hashtags) => {
    if (!Array.isArray(hashtags) || hashtags.length === 0) return false;
    return hashtags.length !== new Set(hashtags).size;
  };

  const platforms = useMemo(() => {
    const unique = new Set(
      posts
        .map((p) => p?.profile_platform)
        .filter(Boolean)
        .map((p) => String(p)),
    );
    return ["all", ...Array.from(unique)];
  }, [posts]);

  const filteredPosts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    return posts.filter((post) => {
      const matchesPlatform =
        selectedPlatform === "all" ||
        post.profile_platform === selectedPlatform;

      const content = String(post?.content || "").toLowerCase();
      const hashtags = Array.isArray(post?.hashtags) ? post.hashtags : [];
      const mentions = Array.isArray(post?.mentions) ? post.mentions : [];

      const matchesSearch =
        !q ||
        content.includes(q) ||
        hashtags.some((tag) =>
          String(tag || "")
            .toLowerCase()
            .includes(q),
        ) ||
        mentions.some((m) =>
          String(m || "")
            .toLowerCase()
            .includes(q),
        );

      const isSuspicious = suspiciousPatterns.some((pattern) => {
        if (!pattern?.type) return false;
        return (
          pattern.type === "high_volume_posting" ||
          (pattern.type === "unusual_posting_hours" &&
            isNightPost(post.posted_at)) ||
          (pattern.type === "repeated_hashtags" &&
            hasRepeatedHashtags(post.hashtags))
        );
      });

      return (
        matchesPlatform &&
        matchesSearch &&
        (!showSuspiciousOnly || isSuspicious)
      );
    });
  }, [
    posts,
    searchTerm,
    selectedPlatform,
    suspiciousPatterns,
    showSuspiciousOnly,
  ]);

  const hasAnySocialPostData =
    posts.length > 0 ||
    (typeof analytics.total_posts === "number" && analytics.total_posts > 0) ||
    suspiciousPatterns.length > 0;

  if (!hasAnySocialPostData) {
    return (
      <section className="bg-[#2D384E] border border-[#37425B] rounded-lg p-6">
        <div className="text-center py-8">
          <MessageSquare className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">
            No Social Media Posts
          </h3>
          <p className="text-slate-400">
            Posts will appear here when collected from identified profiles.
          </p>
          <p className="text-slate-400 mt-2">
            ShadowTrace does not generate sample posts. To collect real posts,
            you’ll need platform APIs (or another approved data source) wired
            into the collector.
          </p>
          <p className="text-slate-400 mt-2">
            If you just enabled post collection, rerun the investigation.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-[#2D384E] border border-[#37425B] rounded-lg p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
          <MessageSquare className="w-5 h-5 mr-2 text-[#00D1FF]" />
          Social Media Posts & Activity
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#303B52] border border-[#37425B] p-4 rounded-lg">
            <div className="text-sm text-slate-300 font-medium">
              Total Posts
            </div>
            <div className="text-2xl font-bold text-white">
              {analytics.total_posts || 0}
            </div>
          </div>
          <div className="bg-[#303B52] border border-[#37425B] p-4 rounded-lg">
            <div className="text-sm text-slate-300 font-medium">Platforms</div>
            <div className="text-2xl font-bold text-white">
              {Object.keys(analytics.platforms || {}).length}
            </div>
          </div>
          <div className="bg-[#303B52] border border-[#37425B] p-4 rounded-lg">
            <div className="text-sm text-slate-300 font-medium">Mentions</div>
            <div className="text-2xl font-bold text-white">
              {(analytics.mentions_found || []).length}
            </div>
          </div>
          <div className="bg-[#303B52] border border-[#37425B] p-4 rounded-lg">
            <div className="text-sm text-slate-300 font-medium">Patterns</div>
            <div className="text-2xl font-bold text-white">
              {suspiciousPatterns.length}
            </div>
          </div>
        </div>

        {suspiciousPatterns.length > 0 && (
          <div className="mb-6 bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg">
            <div className="flex items-center mb-3">
              <AlertTriangle className="w-5 h-5 text-yellow-300 mr-2" />
              <h4 className="font-semibold text-yellow-200">
                Suspicious Activity Patterns Detected
              </h4>
            </div>
            <div className="space-y-2">
              {suspiciousPatterns.map((pattern, index) => (
                <div
                  key={index}
                  className={`p-3 rounded border ${getPatternSeverityClass(pattern.severity)}`}
                >
                  <div className="font-semibold text-sm">
                    {String(pattern.type || "pattern")
                      .replace(/_/g, " ")
                      .toUpperCase()}
                  </div>
                  <div className="text-xs mt-1 text-slate-300">
                    {pattern.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {analytics.platforms && Object.keys(analytics.platforms).length > 0 && (
          <div className="mb-6 bg-[#263043] border border-[#37425B] p-4 rounded-lg">
            <h4 className="font-semibold text-white mb-3 flex items-center">
              <BarChart className="w-4 h-4 mr-2 text-[#00D1FF]" />
              Posts by Platform
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(analytics.platforms).map(([platform, count]) => (
                <div key={platform} className="text-center">
                  <div
                    className={`${getPlatformPillClass(platform)} w-full py-2`}
                  >
                    <div className="font-semibold text-sm capitalize">
                      {platform}
                    </div>
                    <div className="text-lg font-bold">{count}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search posts, hashtags, mentions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#37425B] border border-[#37425B] rounded-lg focus:outline-none focus:border-[#00D1FF] text-slate-100"
            />
          </div>

          <div className="relative">
            <Filter className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
              className="pl-10 pr-8 py-2 bg-[#37425B] border border-[#37425B] rounded-lg focus:outline-none focus:border-[#00D1FF] text-slate-100 appearance-none"
            >
              {platforms.map((platform) => {
                const label =
                  platform === "all"
                    ? "All Platforms"
                    : platform.charAt(0).toUpperCase() + platform.slice(1);

                const count =
                  platform !== "all" && analytics.platforms
                    ? analytics.platforms[platform] || 0
                    : null;

                const full = count != null ? `${label} (${count})` : label;

                return (
                  <option key={platform} value={platform}>
                    {full}
                  </option>
                );
              })}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={showSuspiciousOnly}
              onChange={(e) => setShowSuspiciousOnly(e.target.checked)}
            />
            Suspicious only
          </label>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-semibold text-white flex items-center">
          <MessageSquare className="w-4 h-4 mr-2 text-[#00D1FF]" />
          Recent Posts ({filteredPosts.length})
        </h4>

        {filteredPosts.length > 0 ? (
          filteredPosts.slice(0, 50).map((post, index) => {
            const sentiment = getSentimentPill(post.sentiment_score);

            return (
              <div
                key={index}
                className="border border-[#37425B] rounded-lg p-4 bg-[#303B52]/30"
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={getPlatformPillClass(post.profile_platform)}
                    >
                      {post.profile_platform || "platform"}
                    </span>
                    <span className="text-sm text-slate-300">
                      @{post.profile_username || "unknown"}
                    </span>
                    {sentiment && (
                      <span className={sentiment.className}>
                        {sentiment.label}
                      </span>
                    )}
                    {isNightPost(post.posted_at) && (
                      <span className="px-2 py-1 rounded text-xs font-medium border bg-red-500/10 border-red-500/20 text-red-200">
                        Night post
                      </span>
                    )}
                  </div>

                  <div className="flex items-center text-xs text-slate-400">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatDate(post.posted_at)}
                  </div>
                </div>

                <div className="mb-3">
                  <p className="text-sm text-slate-100 whitespace-pre-wrap">
                    {post.content || "[No text content]"}
                  </p>
                </div>

                <div className="space-y-2">
                  {Array.isArray(post.hashtags) && post.hashtags.length > 0 && (
                    <div className="flex items-center text-xs gap-2">
                      <Hash className="w-3 h-3 text-slate-400" />
                      <div className="flex flex-wrap gap-1">
                        {post.hashtags.slice(0, 10).map((tag, tagIndex) => (
                          <span
                            key={tagIndex}
                            className="bg-blue-500/10 border border-blue-500/20 text-blue-200 px-2 py-1 rounded"
                          >
                            #{tag}
                          </span>
                        ))}
                        {post.hashtags.length > 10 && (
                          <span className="text-slate-400">
                            +{post.hashtags.length - 10} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {Array.isArray(post.mentions) && post.mentions.length > 0 && (
                    <div className="flex items-center text-xs gap-2">
                      <AtSign className="w-3 h-3 text-slate-400" />
                      <div className="flex flex-wrap gap-1">
                        {post.mentions
                          .slice(0, 5)
                          .map((mention, mentionIndex) => (
                            <span
                              key={mentionIndex}
                              className="bg-green-500/10 border border-green-500/20 text-green-200 px-2 py-1 rounded"
                            >
                              @{mention}
                            </span>
                          ))}
                        {post.mentions.length > 5 && (
                          <span className="text-slate-400">
                            +{post.mentions.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {post.location_data && (
                    <div className="flex items-center text-xs gap-2">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span className="text-slate-300">
                        {post.location_data.city}, {post.location_data.country}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                    <div className="flex flex-wrap items-center gap-4">
                      <span>Type: {post.post_type || "text"}</span>
                      {typeof post.engagement_score === "number" && (
                        <span>Engagement: {post.engagement_score}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-8 text-slate-400">
            {analytics.total_posts > 0 && posts.length === 0
              ? "Posts were collected, but none were saved for display yet. Rerun the investigation after updating."
              : searchTerm || selectedPlatform !== "all" || showSuspiciousOnly
                ? "No posts found matching your criteria."
                : "No posts available."}
          </div>
        )}

        {filteredPosts.length > 50 && (
          <div className="text-center py-4 text-slate-400">
            Showing first 50 posts. Use filters to narrow results.
          </div>
        )}
      </div>
    </section>
  );
}
