import {
  Terminal,
  Activity,
  FileText,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";

export function OverviewTab({ ai, parseSeverity, chipClasses }) {
  // Use narrative if available, otherwise fallback to summary
  const narrative =
    ai.investigation_narrative || ai.summary || "No analysis available.";
  const logs = ai.action_log || [];
  const findings = ai.key_findings || [];
  const verdict = ai.verdict || "Unknown";

  const verdictColor =
    {
      Malicious: "text-red-400 border-red-400 bg-red-400/10",
      Suspicious: "text-amber-400 border-amber-400 bg-amber-400/10",
      Safe: "text-emerald-400 border-emerald-400 bg-emerald-400/10",
      Unknown: "text-slate-400 border-slate-400 bg-slate-400/10",
    }[verdict] || "text-slate-400 border-slate-400 bg-slate-400/10";

  return (
    <section className="space-y-6">
      {/* Verdict Banner */}
      <div
        className={`border rounded-lg p-4 flex items-center justify-between ${verdictColor}`}
      >
        <div className="flex items-center gap-3">
          <Activity size={24} />
          <div>
            <div className="text-xs uppercase font-bold tracking-wider opacity-80">
              Investigation Verdict
            </div>
            <div className="text-xl font-bold">{verdict.toUpperCase()}</div>
          </div>
        </div>
        <div className="text-2xl font-mono">{ai.risk_score ?? "?"}/100</div>
      </div>

      {/* Narrative Report */}
      <div className="bg-[#2D384E] rounded-lg p-5 border border-[#37425B]">
        <div className="flex items-center gap-2 mb-3 text-[#00D1FF]">
          <FileText size={18} />
          <h3 className="font-semibold">Investigator's Report</h3>
        </div>
        <div className="text-slate-300 leading-relaxed whitespace-pre-wrap">
          {narrative}
        </div>
      </div>

      {/* Two columns: Findings & Anomalies */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Key Findings */}
        <div className="bg-[#2D384E] rounded-lg p-5 border border-[#37425B]">
          <div className="flex items-center gap-2 mb-3 text-emerald-400">
            <CheckCircle size={18} />
            <h3 className="font-semibold">Key Findings</h3>
          </div>
          {findings.length > 0 ? (
            <ul className="space-y-2">
              {findings.map((f, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-300">
                  <span className="text-emerald-500 font-bold">•</span>
                  {f}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-slate-400 text-sm">
              No specific findings highlighted.
            </div>
          )}
        </div>

        {/* Technical Anomalies */}
        <div className="bg-[#2D384E] rounded-lg p-5 border border-[#37425B]">
          <div className="flex items-center gap-2 mb-3 text-amber-400">
            <AlertTriangle size={18} />
            <h3 className="font-semibold">Technical Anomalies</h3>
          </div>
          {ai.anomalies ? (
            <div className="flex flex-wrap gap-2">
              {String(ai.anomalies)
                .split(/\r?\n|\•|\-|\d+\./)
                .map((s) => s.trim())
                .filter(Boolean)
                .map((item, idx) => {
                  const sev = parseSeverity(item);
                  return (
                    <span
                      key={idx}
                      className={`text-xs px-2 py-1 rounded-full border ${chipClasses(sev)}`}
                    >
                      {item}
                    </span>
                  );
                })}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">None detected.</p>
          )}
        </div>
      </div>

      {/* Investigation Log (Terminal style) */}
      <div className="bg-[#1E2330] rounded-lg p-0 border border-[#37425B] overflow-hidden font-mono text-sm">
        <div className="bg-[#2D384E] p-2 px-4 flex items-center gap-2 border-b border-[#37425B]">
          <Terminal size={14} className="text-slate-400" />
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
            Investigation Log
          </span>
        </div>
        <div className="p-4 space-y-1.5 max-h-60 overflow-y-auto">
          {logs.length > 0 ? (
            logs.map((log, i) => (
              <div key={i} className="flex gap-3 text-slate-300">
                <span className="text-slate-500 select-none">
                  {(i + 1).toString().padStart(2, "0")}
                </span>
                <span>{log}</span>
              </div>
            ))
          ) : (
            <div className="text-slate-500 italic">Log not available.</div>
          )}
          <div className="flex gap-3 text-[#00D1FF] animate-pulse">
            <span className="text-slate-500 select-none">
              {((logs.length || 0) + 1).toString().padStart(2, "0")}
            </span>
            <span>Investigation completed.</span>
          </div>
        </div>
      </div>
    </section>
  );
}
