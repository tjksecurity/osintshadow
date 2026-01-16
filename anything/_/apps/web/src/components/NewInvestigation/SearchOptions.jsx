import { Landmark, Gavel, Fingerprint, Car, MessageSquare } from "lucide-react";

export function SearchOptions({
  includeWebScraping,
  setIncludeWebScraping,
  includeNSFW,
  setIncludeNSFW,
  includeProperty,
  setIncludeProperty,
  includeCourt,
  setIncludeCourt,
  includeCriminal,
  setIncludeCriminal,
  targetType,
  includeLicensePlate,
  setIncludeLicensePlate,
  // NEW: Social media post collection
  includePostCollection,
  setIncludePostCollection,
}) {
  return (
    <div>
      <h3 className="text-sm font-medium text-slate-300 mb-3">
        Search Options
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex items-center gap-3 p-3 rounded-md border border-[#37425B] bg-[#37425B]/40">
          <input
            type="checkbox"
            checked={includeWebScraping}
            onChange={(e) => setIncludeWebScraping(e.target.checked)}
            className="h-4 w-4 rounded border-slate-500 text-[#00D1FF] focus:ring-[#00D1FF]"
          />
          <div>
            <div className="font-medium text-sm">Enable Web Scraping</div>
            <div className="text-xs text-slate-400">
              Discover extra phones/emails from hubs and contact pages
            </div>
          </div>
        </label>
        <label className="flex items-center gap-3 p-3 rounded-md border border-[#37425B] bg-[#37425B]/40">
          <input
            type="checkbox"
            checked={includeNSFW}
            onChange={(e) => setIncludeNSFW(e.target.checked)}
            className="h-4 w-4 rounded border-slate-500 text-[#00D1FF] focus:ring-[#00D1FF]"
          />
          <div>
            <div className="font-medium text-sm">Include NSFW sources</div>
            <div className="text-xs text-slate-400">
              Also scan adult/dating/fetish sites for handle matches
            </div>
          </div>
        </label>

        {/* NEW: Social media post collection option */}
        <label className="flex items-center gap-3 p-3 rounded-md border border-[#37425B] bg-[#37425B]/40">
          <input
            type="checkbox"
            checked={includePostCollection}
            onChange={(e) => setIncludePostCollection(e.target.checked)}
            className="h-4 w-4 rounded border-slate-500 text-[#00D1FF] focus:ring-[#00D1FF]"
          />
          <div>
            <div className="font-medium text-sm flex items-center gap-2">
              <MessageSquare size={14} /> Collect social media posts
            </div>
            <div className="text-xs text-slate-400">
              Gather recent posts to analyze patterns and connections
            </div>
          </div>
        </label>

        <label className="flex items-center gap-3 p-3 rounded-md border border-[#37425B] bg-[#37425B]/40">
          <input
            type="checkbox"
            checked={includeProperty}
            onChange={(e) => setIncludeProperty(e.target.checked)}
            className="h-4 w-4 rounded border-slate-500 text-[#00D1FF] focus:ring-[#00D1FF]"
          />
          <div>
            <div className="font-medium text-sm flex items-center gap-2">
              <Landmark size={14} /> Property deeds
            </div>
            <div className="text-xs text-slate-400">
              Address search for deed owner, buyer/seller, price
            </div>
          </div>
        </label>
        <label className="flex items-center gap-3 p-3 rounded-md border border-[#37425B] bg-[#37425B]/40">
          <input
            type="checkbox"
            checked={includeCourt}
            onChange={(e) => setIncludeCourt(e.target.checked)}
            className="h-4 w-4 rounded border-slate-500 text-[#00D1FF] focus:ring-[#00D1FF]"
          />
          <div>
            <div className="font-medium text-sm flex items-center gap-2">
              <Gavel size={14} /> Court filings
            </div>
            <div className="text-xs text-slate-400">
              Dockets and opinions matched by name/keywords
            </div>
          </div>
        </label>
        <label className="flex items-center gap-3 p-3 rounded-md border border-[#37425B] bg-[#37425B]/40">
          <input
            type="checkbox"
            checked={includeCriminal}
            onChange={(e) => setIncludeCriminal(e.target.checked)}
            className="h-4 w-4 rounded border-slate-500 text-[#00D1FF] focus:ring-[#00D1FF]"
          />
          <div>
            <div className="font-medium text-sm flex items-center gap-2">
              <Fingerprint size={14} /> Criminal background
            </div>
            <div className="text-xs text-slate-400">
              Public case mentions (best‑effort, varies by county)
            </div>
          </div>
        </label>
        {targetType === "license_plate" && (
          <label className="flex items-center gap-3 p-3 rounded-md border border-[#37425B] bg-[#37425B]/40">
            <input
              type="checkbox"
              checked={includeLicensePlate}
              onChange={(e) => setIncludeLicensePlate(e.target.checked)}
              className="h-4 w-4 rounded border-slate-500 text-[#00D1FF] focus:ring-[#00D1FF]"
            />
            <div>
              <div className="font-medium text-sm flex items-center gap-2">
                <Car size={14} /> License plate lookup
              </div>
              <div className="text-xs text-slate-400">
                Requires provider API configured in Settings (keys)
              </div>
            </div>
          </label>
        )}
      </div>
    </div>
  );
}
