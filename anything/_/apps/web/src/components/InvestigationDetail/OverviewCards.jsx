import { Sparkles, AlertTriangle } from "lucide-react";

export function OverviewCards({
  investigation,
  ai,
  summaryPreview,
  anomaliesPreviewItems,
  parseSeverity,
  chipClasses,
  riskColor,
  onOpenAITab,
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-[#2D384E] rounded-lg p-4">
        <div className="text-slate-400 text-sm">Target</div>
        <div className="mt-1 font-semibold">{investigation.target_value}</div>
        <div className="mt-1 text-xs capitalize text-slate-400">
          {investigation.target_type}
        </div>
      </div>
      <div className="bg-[#2D384E] rounded-lg p-4">
        <div className="text-slate-400 text-sm">Created</div>
        <div className="mt-1 font-semibold">
          {new Date(investigation.created_at).toLocaleString()}
        </div>
      </div>
      <div className="bg-[#2D384E] rounded-lg p-4">
        <div className="text-slate-400 text-sm">Risk Score</div>
        <div className={`mt-1 font-semibold ${riskColor(ai.risk_score)}`}>
          {ai.risk_score != null ? `${ai.risk_score}/100` : "-"}
        </div>
      </div>
      <div className="bg-[#2D384E] rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="text-slate-400 text-sm flex items-center gap-2">
            <Sparkles size={16} /> AI Summary
          </div>
          <button
            onClick={onOpenAITab}
            className="text-[#00D1FF] hover:underline text-xs"
          >
            Open AI Tab
          </button>
        </div>
        <div className="mt-1 text-slate-200 text-sm min-h-[48px]">
          {summaryPreview || "Not available yet."}
        </div>
      </div>
      <div className="bg-[#2D384E] rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="text-slate-400 text-sm flex items-center gap-2">
            <AlertTriangle size={16} /> Anomalies
          </div>
          <button
            onClick={onOpenAITab}
            className="text-[#00D1FF] hover:underline text-xs"
          >
            Open AI Tab
          </button>
        </div>
        {anomaliesPreviewItems.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {anomaliesPreviewItems.map((item, idx) => {
              const sev = parseSeverity(item);
              return (
                <span
                  key={idx}
                  className={`text-xs px-2 py-1 rounded-full ${chipClasses(sev)}`}
                >
                  {sev !== "unknown" ? `${sev.toUpperCase()}: ` : ""}
                  {item}
                </span>
              );
            })}
          </div>
        ) : (
          <div className="mt-1 text-slate-300 text-sm">None detected.</div>
        )}
      </div>
    </div>
  );
}
