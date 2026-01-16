import { useState, useEffect } from "react";
import {
  Users,
  ExternalLink,
  Shield,
  Eye,
  AlertTriangle,
  CheckCircle,
  Star,
  Calendar,
  MapPin,
} from "lucide-react";
import { StatusBadge } from "./StatusBadge";

export function SocialMediaTab({ investigationId }) {
  const [profiles, setProfiles] = useState([]);
  const [platformSummary, setPlatformSummary] = useState([]);
  const [monitoring, setMonitoring] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPlatform, setSelectedPlatform] = useState("all");
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [sortBy, setSortBy] = useState("risk_score");

  useEffect(() => {
    fetchSocialProfiles();
  }, [investigationId, selectedPlatform]);

  const fetchSocialProfiles = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        investigation_id: investigationId,
        include_monitoring: "true",
      });

      if (selectedPlatform !== "all") {
        params.append("platform", selectedPlatform);
      }

      const response = await fetch(`/api/social-profiles?${params}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      setProfiles(data.profiles || []);
      setPlatformSummary(data.platform_summary || []);
      setMonitoring(data.monitoring || []);
    } catch (err) {
      console.error("Failed to fetch social profiles:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getPlatformIcon = (platform) => {
    const icons = {
      twitter: "𝕏",
      instagram: "📷",
      linkedin: "💼",
      facebook: "👥",
      tiktok: "🎵",
      youtube: "📺",
      reddit: "🗨️",
    };
    return icons[platform.toLowerCase()] || "🌐";
  };

  const getRiskColor = (riskScore) => {
    if (riskScore >= 80) return "text-red-400";
    if (riskScore >= 60) return "text-orange-400";
    if (riskScore >= 40) return "text-yellow-400";
    return "text-green-400";
  };

  const getRiskBadgeColor = (riskScore) => {
    if (riskScore >= 80) return "bg-red-500/10 border-red-500/20";
    if (riskScore >= 60) return "bg-orange-500/10 border-orange-500/20";
    if (riskScore >= 40) return "bg-yellow-500/10 border-yellow-500/20";
    return "bg-green-500/10 border-green-500/20";
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num?.toString() || "0";
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Unknown";
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return "Invalid date";
    }
  };

  const sortedProfiles = [...profiles].sort((a, b) => {
    switch (sortBy) {
      case "risk_score":
        return (b.risk_score || 0) - (a.risk_score || 0);
      case "followers":
        return (b.followers_count || 0) - (a.followers_count || 0);
      case "username":
        return (a.username || "").localeCompare(b.username || "");
      case "platform":
        return (a.platform || "").localeCompare(b.platform || "");
      default:
        return 0;
    }
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-slate-400">
          Loading social media data...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="text-red-400" size={20} />
          <span className="text-red-400 font-medium">
            Error loading social media data
          </span>
        </div>
        <p className="text-red-400/80 text-sm mt-2">{error}</p>
        <button
          onClick={fetchSocialProfiles}
          className="mt-3 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-md text-sm transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="mx-auto text-slate-400 mb-4" size={48} />
        <h3 className="text-lg font-medium text-slate-300 mb-2">
          No Social Media Profiles Found
        </h3>
        <p className="text-slate-400">
          No social media profiles were discovered for this investigation
          target.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Platform Summary Cards */}
      {platformSummary.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-slate-200 mb-4 flex items-center gap-2">
            <Users size={20} />
            Platform Overview
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {platformSummary.map((platform) => (
              <div
                key={platform.platform}
                className="bg-[#37425B] rounded-lg p-4 hover:bg-[#3D4A5C] transition-colors cursor-pointer"
                onClick={() => setSelectedPlatform(platform.platform)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {getPlatformIcon(platform.platform)}
                    </span>
                    <span className="font-medium text-slate-200 capitalize">
                      {platform.platform}
                    </span>
                  </div>
                  {platform.verified_count > 0 && (
                    <CheckCircle className="text-blue-400" size={16} />
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Profiles:</span>
                    <span className="text-slate-200">
                      {platform.profile_count}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Avg Risk:</span>
                    <span className={getRiskColor(platform.avg_risk_score)}>
                      {Math.round(platform.avg_risk_score || 0)}%
                    </span>
                  </div>
                  {platform.verified_count > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Verified:</span>
                      <span className="text-blue-400">
                        {platform.verified_count}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters and Controls */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedPlatform("all")}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              selectedPlatform === "all"
                ? "bg-blue-500 text-white"
                : "bg-slate-600 text-slate-300 hover:bg-slate-500"
            }`}
          >
            All Platforms
          </button>
          {platformSummary.map((platform) => (
            <button
              key={platform.platform}
              onClick={() => setSelectedPlatform(platform.platform)}
              className={`px-3 py-1 rounded-full text-sm transition-colors flex items-center gap-1 ${
                selectedPlatform === platform.platform
                  ? "bg-blue-500 text-white"
                  : "bg-slate-600 text-slate-300 hover:bg-slate-500"
              }`}
            >
              <span>{getPlatformIcon(platform.platform)}</span>
              <span className="capitalize">{platform.platform}</span>
              <span className="bg-slate-700/50 px-1 rounded text-xs">
                {platform.profile_count}
              </span>
            </button>
          ))}
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-2 bg-[#37425B] text-slate-200 rounded-md border border-slate-500 focus:border-blue-500"
        >
          <option value="risk_score">Sort by Risk Score</option>
          <option value="followers">Sort by Followers</option>
          <option value="username">Sort by Username</option>
          <option value="platform">Sort by Platform</option>
        </select>
      </div>

      {/* Profiles Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sortedProfiles.map((profile) => (
          <div
            key={profile.id}
            className="bg-[#37425B] rounded-lg p-4 hover:bg-[#3D4A5C] transition-colors cursor-pointer"
            onClick={() => setSelectedProfile(profile)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  {profile.profile_image_url ? (
                    <img
                      src={profile.profile_image_url}
                      alt={`${profile.username} avatar`}
                      className="w-10 h-10 rounded-full"
                      onError={(e) => {
                        e.target.style.display = "none";
                        e.target.nextSibling.style.display = "flex";
                      }}
                    />
                  ) : (
                    <div className="w-10 h-10 bg-slate-600 rounded-full flex items-center justify-center">
                      <span className="text-lg">
                        {getPlatformIcon(profile.platform)}
                      </span>
                    </div>
                  )}
                  <div className="w-10 h-10 bg-slate-600 rounded-full items-center justify-center hidden">
                    <span className="text-lg">
                      {getPlatformIcon(profile.platform)}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-slate-200">
                      {profile.username}
                    </h4>
                    {profile.verified && (
                      <CheckCircle className="text-blue-400" size={16} />
                    )}
                  </div>
                  {profile.display_name &&
                    profile.display_name !== profile.username && (
                      <p className="text-sm text-slate-400">
                        {profile.display_name}
                      </p>
                    )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-500 capitalize">
                      {profile.platform}
                    </span>
                    <span className="text-xs text-slate-500">•</span>
                    <span className="text-xs text-slate-500">
                      {formatNumber(profile.followers_count)} followers
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <div
                  className={`px-2 py-1 rounded border text-xs font-medium ${getRiskBadgeColor(profile.risk_score)}`}
                >
                  <div className="flex items-center gap-1">
                    <Shield size={12} />
                    <span className={getRiskColor(profile.risk_score)}>
                      {profile.risk_score || 0}% Risk
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {profile.bio && (
              <p className="text-sm text-slate-400 mb-3 line-clamp-2">
                {profile.bio}
              </p>
            )}

            <div className="flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-4">
                <span>{formatNumber(profile.following_count)} following</span>
                <span>{formatNumber(profile.posts_count)} posts</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar size={10} />
                <span>Found {formatDate(profile.created_at)}</span>
              </div>
            </div>

            {profile.profile_url && (
              <div className="flex justify-end mt-2">
                <a
                  href={profile.profile_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <span>View Profile</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Monitoring Status */}
      {monitoring.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-slate-200 mb-4 flex items-center gap-2">
            <Eye size={20} />
            Real-time Monitoring
          </h3>
          <div className="bg-[#37425B] rounded-lg p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {monitoring.map((monitor, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-slate-600/30 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <span>{getPlatformIcon(monitor.platform)}</span>
                    <div>
                      <div className="text-sm font-medium text-slate-200">
                        {monitor.target_username}
                      </div>
                      <div className="text-xs text-slate-400 capitalize">
                        {monitor.platform}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <StatusBadge
                      status={monitor.monitoring_active ? "active" : "inactive"}
                    />
                    <div className="text-xs text-slate-500 mt-1">
                      {monitor.posts_collected} posts
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Profile Detail Modal */}
      {selectedProfile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-[#2D384E] rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {selectedProfile.profile_image_url ? (
                    <img
                      src={selectedProfile.profile_image_url}
                      alt={`${selectedProfile.username} avatar`}
                      className="w-16 h-16 rounded-full"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-slate-600 rounded-full flex items-center justify-center">
                      <span className="text-2xl">
                        {getPlatformIcon(selectedProfile.platform)}
                      </span>
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-semibold text-slate-200">
                        {selectedProfile.username}
                      </h2>
                      {selectedProfile.verified && (
                        <CheckCircle className="text-blue-400" size={20} />
                      )}
                    </div>
                    {selectedProfile.display_name && (
                      <p className="text-slate-400">
                        {selectedProfile.display_name}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-slate-500 capitalize">
                        {selectedProfile.platform}
                      </span>
                      {selectedProfile.discovery_method && (
                        <>
                          <span className="text-slate-500">•</span>
                          <span className="text-sm text-slate-500">
                            Found via{" "}
                            {selectedProfile.discovery_method.replace("_", " ")}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedProfile(null)}
                  className="text-slate-400 hover:text-slate-200 text-xl"
                >
                  ×
                </button>
              </div>

              {selectedProfile.bio && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-slate-300 mb-2">
                    Bio
                  </h3>
                  <p className="text-slate-400">{selectedProfile.bio}</p>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-3 bg-slate-600/20 rounded-lg">
                  <div className="text-lg font-semibold text-slate-200">
                    {formatNumber(selectedProfile.followers_count)}
                  </div>
                  <div className="text-xs text-slate-400">Followers</div>
                </div>
                <div className="text-center p-3 bg-slate-600/20 rounded-lg">
                  <div className="text-lg font-semibold text-slate-200">
                    {formatNumber(selectedProfile.following_count)}
                  </div>
                  <div className="text-xs text-slate-400">Following</div>
                </div>
                <div className="text-center p-3 bg-slate-600/20 rounded-lg">
                  <div className="text-lg font-semibold text-slate-200">
                    {formatNumber(selectedProfile.posts_count)}
                  </div>
                  <div className="text-xs text-slate-400">Posts</div>
                </div>
                <div className="text-center p-3 bg-slate-600/20 rounded-lg">
                  <div
                    className={`text-lg font-semibold ${getRiskColor(selectedProfile.risk_score)}`}
                  >
                    {selectedProfile.risk_score || 0}%
                  </div>
                  <div className="text-xs text-slate-400">Risk Score</div>
                </div>
              </div>

              <div className="flex gap-3">
                {selectedProfile.profile_url && (
                  <a
                    href={selectedProfile.profile_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
                  >
                    <ExternalLink size={16} />
                    View on {selectedProfile.platform}
                  </a>
                )}
                <button
                  onClick={() => setSelectedProfile(null)}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded-md transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
