import { Shield, Image as ImageIcon, Users, Eye } from "lucide-react";

export function AdvancedOptions({
  includeDeepScan,
  setIncludeDeepScan,
  includeDeepImageScan,
  setIncludeDeepImageScan,
  includeSocialMedia,
  setIncludeSocialMedia,
  socialPlatforms,
  setSocialPlatforms,
  enableRealTimeMonitoring,
  setEnableRealTimeMonitoring,
}) {
  const allPlatforms = [
    { id: "twitter", name: "Twitter/X", icon: "𝕏" },
    { id: "instagram", name: "Instagram", icon: "📷" },
    { id: "linkedin", name: "LinkedIn", icon: "💼" },
    { id: "facebook", name: "Facebook", icon: "👥" },
    { id: "tiktok", name: "TikTok", icon: "🎵" },
    { id: "youtube", name: "YouTube", icon: "📺" },
    { id: "reddit", name: "Reddit", icon: "🗨️" },
  ];

  const handlePlatformChange = (platformId, checked) => {
    if (checked) {
      setSocialPlatforms([...socialPlatforms, platformId]);
    } else {
      setSocialPlatforms(socialPlatforms.filter((id) => id !== platformId));
    }
  };

  return (
    <div className="pt-2 space-y-6">
      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
          <Shield size={14} /> Advanced / Deep Scan
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex items-center gap-3 p-3 rounded-md border border-[#37425B] bg-[#37425B]/40 border-l-4 border-l-[#00D1FF]">
            <input
              type="checkbox"
              checked={includeDeepScan}
              onChange={(e) => setIncludeDeepScan(e.target.checked)}
              className="h-4 w-4 rounded border-slate-500 text-[#00D1FF] focus:ring-[#00D1FF]"
            />
            <div>
              <div className="font-medium text-sm flex items-center gap-2">
                Deep scan (OSINT)
              </div>
              <div className="text-xs text-slate-400">
                Wider username permutations and more hubs (longer run)
              </div>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 rounded-md border border-[#37425B] bg-[#37425B]/40 border-l-4 border-l-[#00D1FF]">
            <input
              type="checkbox"
              checked={includeDeepImageScan}
              onChange={(e) => setIncludeDeepImageScan(e.target.checked)}
              className="h-4 w-4 rounded border-slate-500 text-[#00D1FF] focus:ring-[#00D1FF]"
            />
            <div>
              <div className="font-medium text-sm flex items-center gap-2">
                <ImageIcon size={14} /> Deep image scan
              </div>
              <div className="text-xs text-slate-400">
                Fetch more pages and images (longer run)
              </div>
            </div>
          </label>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
          <Users size={14} /> Social Media Monitoring
        </h3>

        <div className="space-y-4">
          <label className="flex items-center gap-3 p-3 rounded-md border border-[#37425B] bg-[#37425B]/40 border-l-4 border-l-[#9333EA]">
            <input
              type="checkbox"
              checked={includeSocialMedia}
              onChange={(e) => setIncludeSocialMedia(e.target.checked)}
              className="h-4 w-4 rounded border-slate-500 text-[#9333EA] focus:ring-[#9333EA]"
            />
            <div>
              <div className="font-medium text-sm">
                Enable social media search
              </div>
              <div className="text-xs text-slate-400">
                Search for profiles across social platforms
              </div>
            </div>
          </label>

          {includeSocialMedia && (
            <div className="ml-7 space-y-3">
              <div>
                <h4 className="text-xs font-medium text-slate-400 mb-2">
                  Platforms to search:
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {allPlatforms.map((platform) => (
                    <label
                      key={platform.id}
                      className="flex items-center gap-2 p-2 rounded border border-slate-600 bg-slate-700/30 hover:bg-slate-600/30 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={socialPlatforms.includes(platform.id)}
                        onChange={(e) =>
                          handlePlatformChange(platform.id, e.target.checked)
                        }
                        className="h-3 w-3 rounded border-slate-500 text-[#9333EA] focus:ring-[#9333EA]"
                      />
                      <span className="text-xs">{platform.icon}</span>
                      <span className="text-xs text-slate-300">
                        {platform.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-3 p-3 rounded-md border border-[#37425B] bg-[#37425B]/40 border-l-4 border-l-[#F59E0B]">
                <input
                  type="checkbox"
                  checked={enableRealTimeMonitoring}
                  onChange={(e) =>
                    setEnableRealTimeMonitoring(e.target.checked)
                  }
                  className="h-4 w-4 rounded border-slate-500 text-[#F59E0B] focus:ring-[#F59E0B]"
                />
                <div>
                  <div className="font-medium text-sm flex items-center gap-2">
                    <Eye size={14} /> Real-time monitoring
                  </div>
                  <div className="text-xs text-slate-400">
                    Monitor high-confidence profiles for new activity
                  </div>
                </div>
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
