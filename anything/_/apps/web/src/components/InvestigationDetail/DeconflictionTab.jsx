import { AlertTriangle, CheckCircle2, GitCompare } from "lucide-react";
import { JSONViewer } from "@/components/InvestigationDetail/JSONViewer";

function severityChipClass(sev) {
  const s = String(sev || "").toLowerCase();
  if (s === "high") return "bg-red-500/15 text-red-200 border-red-500/30";
  if (s === "medium")
    return "bg-amber-500/15 text-amber-200 border-amber-500/30";
  return "bg-slate-500/15 text-slate-200 border-slate-500/30";
}

function pickLatestDeconfliction(osintRaw) {
  const rows = Array.isArray(osintRaw) ? osintRaw : [];
  let latest = null;

  for (const r of rows) {
    if (r?.data_json?.type !== "deconfliction") continue;
    if (!latest) {
      latest = r;
      continue;
    }

    const latestTime = latest?.created_at
      ? new Date(latest.created_at).getTime()
      : 0;
    const currentTime = r?.created_at ? new Date(r.created_at).getTime() : 0;

    if (currentTime >= latestTime) {
      latest = r;
    }
  }

  return latest;
}

export default function DeconflictionTab({ osintRaw }) {
  const latestRow = pickLatestDeconfliction(osintRaw);
  const deconfliction = latestRow?.data_json || null;

  const generatedAtText = deconfliction?.generated_at
    ? new Date(deconfliction.generated_at).toLocaleString()
    : latestRow?.created_at
      ? new Date(latestRow.created_at).toLocaleString()
      : null;

  const conflicts = Array.isArray(deconfliction?.conflicts)
    ? deconfliction.conflicts
    : [];
  const counts = deconfliction?.counts || null;
  const hasConflicts = conflicts.length > 0;

  return (
    <section className="space-y-4">
      <div className="bg-[#2D384E] rounded-lg p-5 border border-[#37425B]">
        <div className="flex items-center gap-2 mb-2 text-[#00D1FF]">
          <GitCompare size={18} />
          <h3 className="font-semibold">Source Deconfliction</h3>
        </div>

        <p className="text-slate-300 text-sm">
          This tab flags places where different sources disagree on key identity
          metadata. It helps you avoid accidental merges when the data is noisy
          or mixed.
        </p>

        {!deconfliction ? (
          <div className="mt-4 border border-[#37425B] rounded-lg p-4">
            <div className="flex items-center gap-2 text-slate-200">
              <AlertTriangle size={18} className="text-amber-300" />
              <div className="font-semibold">No deconfliction data yet</div>
            </div>
            <div className="text-slate-400 text-sm mt-1">
              Run (or regenerate) the investigation to compute deconfliction.
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="border border-[#37425B] rounded-lg p-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div className="text-slate-200 font-medium">Summary</div>
                {generatedAtText ? (
                  <div className="text-xs text-slate-400">
                    Generated {generatedAtText}
                  </div>
                ) : null}
              </div>

              {counts ? (
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-1 rounded border border-[#37425B] bg-[#263043] text-slate-200">
                    Total: {counts.total}
                  </span>
                  <span
                    className={`px-2 py-1 rounded border ${severityChipClass("high")}`}
                  >
                    High: {counts.high}
                  </span>
                  <span
                    className={`px-2 py-1 rounded border ${severityChipClass("medium")}`}
                  >
                    Medium: {counts.medium}
                  </span>
                  <span
                    className={`px-2 py-1 rounded border ${severityChipClass("low")}`}
                  >
                    Low: {counts.low}
                  </span>
                </div>
              ) : null}

              {!hasConflicts ? (
                <div className="mt-3 flex items-center gap-2 text-emerald-300">
                  <CheckCircle2 size={18} />
                  <div className="text-sm">No conflicts flagged.</div>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {conflicts.map((c, idx) => {
                    const vals = Array.isArray(c?.values) ? c.values : [];
                    const sev = c?.severity || "low";
                    const chip = severityChipClass(sev);
                    const title = c?.field_key
                      ? String(c.field_key)
                      : "Conflict";
                    const summary = c?.summary || null;

                    return (
                      <div
                        key={idx}
                        className="border border-[#37425B] rounded-lg p-4"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-semibold text-white">
                            {title}
                          </div>
                          <div
                            className={`text-xs px-2 py-0.5 rounded border ${chip}`}
                          >
                            {String(sev).toUpperCase()}
                          </div>
                          {c?.conflict_type ? (
                            <div className="text-xs text-slate-400">
                              {c.conflict_type}
                            </div>
                          ) : null}
                        </div>

                        {summary ? (
                          <div className="text-sm text-slate-300 mt-1">
                            {summary}
                          </div>
                        ) : null}

                        <div className="mt-3 space-y-2">
                          {vals.length === 0 ? (
                            <div className="text-sm text-slate-400">
                              No competing values listed.
                            </div>
                          ) : (
                            vals.map((v, j) => {
                              const sources = Array.isArray(v?.sources)
                                ? v.sources
                                : [];
                              const valueText = v?.value || "";

                              return (
                                <div
                                  key={j}
                                  className="border border-[#37425B] rounded-lg p-3 bg-[#283247]"
                                >
                                  <div className="text-slate-200 break-words">
                                    {valueText}
                                  </div>

                                  {sources.length > 0 ? (
                                    <div className="mt-2 space-y-1">
                                      {sources.slice(0, 10).map((s, k) => {
                                        const name =
                                          s?.name || "Unknown source";
                                        const url = s?.url || null;
                                        const kind = s?.kind || null;
                                        const confidence =
                                          typeof s?.confidence === "number"
                                            ? s.confidence
                                            : null;

                                        const metaParts = [];
                                        if (kind) metaParts.push(kind);
                                        if (confidence != null)
                                          metaParts.push(`conf ${confidence}`);
                                        const metaText = metaParts.join(" • ");

                                        return (
                                          <div
                                            key={k}
                                            className="text-xs text-slate-400"
                                          >
                                            {url ? (
                                              <a
                                                href={url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-[#00D1FF] hover:underline"
                                              >
                                                {name}
                                              </a>
                                            ) : (
                                              <span className="text-slate-300">
                                                {name}
                                              </span>
                                            )}
                                            {metaText ? (
                                              <span className="ml-2">
                                                ({metaText})
                                              </span>
                                            ) : null}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div className="text-xs text-slate-500 mt-1">
                                      No sources listed.
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border border-[#37425B] rounded-lg p-4">
              <div className="text-slate-200 font-medium mb-2">
                Raw deconfliction payload
              </div>
              <JSONViewer data={deconfliction} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
