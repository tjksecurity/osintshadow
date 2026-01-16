export function ConfirmedDataTab({ confirmed, hasConfirmed, osintRaw }) {
  const confirmedProfiles = (confirmed?.profiles || []).slice(0, 200);
  const confirmedPhones = (confirmed?.phones || []).slice(0, 200);
  const confirmedEmails = (confirmed?.emails || []).slice(0, 200);
  const confirmedDomains = (confirmed?.domains || []).slice(0, 200);
  const confirmedHandles = (confirmed?.handles || []).slice(0, 200);

  // Find the most recent deconfliction payload from osint_raw
  const rawRows = Array.isArray(osintRaw) ? osintRaw : [];
  let deconfliction = null;
  for (const r of rawRows) {
    if (r?.data_json?.type === "deconfliction") {
      deconfliction = r.data_json;
    }
  }

  const conflicts = Array.isArray(deconfliction?.conflicts)
    ? deconfliction.conflicts
    : [];

  const counts = deconfliction?.counts || null;
  const hasConflicts = conflicts.length > 0;

  const severityChipClass = (sev) => {
    const s = String(sev || "").toLowerCase();
    if (s === "high") return "bg-red-500/15 text-red-200 border-red-500/30";
    if (s === "medium")
      return "bg-amber-500/15 text-amber-200 border-amber-500/30";
    return "bg-slate-500/15 text-slate-200 border-slate-500/30";
  };

  return (
    <section className="space-y-4">
      <div className="bg-[#2D384E] rounded-lg p-4">
        <h3 className="font-semibold mb-1">Confirmed Data</h3>
        <p className="text-slate-300 text-sm mb-3">
          Curated by AI from evidence-backed and high-confidence items. This
          view does not hide fields; it only filters to likely-accurate data.
        </p>

        {/* Deconfliction */}
        <div className="border border-[#37425B] rounded-lg p-3 mb-4">
          <div className="font-semibold mb-1">Deconfliction</div>
          <div className="text-slate-300 text-sm">
            Flags places where different sources disagree on key identity
            metadata (helps avoid accidental merges).
          </div>

          {!deconfliction ? (
            <div className="text-slate-400 text-sm mt-2">
              No deconfliction results yet.
            </div>
          ) : !hasConflicts ? (
            <div className="text-slate-200 text-sm mt-2">
              No conflicts flagged.
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {counts ? (
                <div className="text-xs text-slate-400">
                  Total: {counts.total} • High: {counts.high} • Medium:{" "}
                  {counts.medium} • Low: {counts.low}
                </div>
              ) : null}

              {conflicts.slice(0, 20).map((c, idx) => {
                const vals = Array.isArray(c?.values) ? c.values : [];
                const sev = c?.severity || "low";
                const chip = severityChipClass(sev);
                const title = c?.field_key ? `${c.field_key}` : "Conflict";
                const summary = c?.summary || null;

                return (
                  <div
                    key={idx}
                    className="border border-[#37425B] rounded-lg p-3"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-semibold">{title}</div>
                      <div
                        className={`text-xs px-2 py-0.5 rounded border ${chip}`}
                      >
                        {String(sev).toUpperCase()}
                      </div>
                    </div>

                    {summary ? (
                      <div className="text-sm text-slate-300 mt-1">
                        {summary}
                      </div>
                    ) : null}

                    <div className="mt-2 space-y-2">
                      {vals.map((v, j) => {
                        const sources = Array.isArray(v?.sources)
                          ? v.sources
                          : [];
                        const sourceText = sources
                          .map((s) => s?.name)
                          .filter(Boolean)
                          .slice(0, 4)
                          .join(", ");
                        const valueText = v?.value || "";

                        return (
                          <div key={j} className="text-sm">
                            <div className="text-slate-200 break-words">
                              {valueText}
                            </div>
                            {sourceText ? (
                              <div className="text-xs text-slate-400">
                                Sources: {sourceText}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {!hasConfirmed && (
          <div className="text-slate-300">
            No confirmed data yet. Try "Regenerate with AI" to compute it for
            this investigation.
          </div>
        )}
        {hasConfirmed && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Profiles */}
            <div className="border border-[#37425B] rounded-lg p-3">
              <div className="font-semibold mb-2">Profiles</div>
              {confirmedProfiles.length === 0 ? (
                <div className="text-slate-400 text-sm">None</div>
              ) : (
                <ul className="space-y-2">
                  {confirmedProfiles.map((p, idx) => {
                    const reasons = (p.reasons || []).join(", ");
                    return (
                      <li key={idx} className="text-sm">
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#00D1FF] hover:underline"
                        >
                          {p.platform}
                        </a>
                        <span className="text-slate-400">
                          {" "}
                          — {p.handle || "(unknown handle)"}
                        </span>
                        {reasons && (
                          <div className="text-xs text-slate-400">
                            Reasons: {reasons}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Phones */}
            <div className="border border-[#37425B] rounded-lg p-3">
              <div className="font-semibold mb-2">Phone Numbers</div>
              {confirmedPhones.length === 0 ? (
                <div className="text-slate-400 text-sm">None</div>
              ) : (
                <ul className="space-y-2">
                  {confirmedPhones.map((ph, idx) => {
                    const src = ph?.sources;
                    const hasSeed = !!src?.seed_source_url;
                    const reasons = (ph?.reasons || []).join(", ");
                    return (
                      <li key={idx} className="text-sm">
                        <span className="text-slate-200">{ph.phone}</span>
                        {reasons && (
                          <div className="text-xs text-slate-400">
                            Reasons: {reasons}
                          </div>
                        )}
                        {hasSeed && (
                          <div className="text-xs">
                            Source:{" "}
                            <a
                              href={src.seed_source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#00D1FF] hover:underline"
                            >
                              {src.seed_source_url}
                            </a>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Emails */}
            <div className="border border-[#37425B] rounded-lg p-3">
              <div className="font-semibold mb-2">Emails</div>
              {confirmedEmails.length === 0 ? (
                <div className="text-slate-400 text-sm">None</div>
              ) : (
                <ul className="space-y-2">
                  {confirmedEmails.map((em, idx) => {
                    const reasons = (em?.reasons || []).join(", ");
                    return (
                      <li key={idx} className="text-sm">
                        <span className="text-slate-200">{em.email}</span>
                        {reasons && (
                          <div className="text-xs text-slate-400">
                            Reasons: {reasons}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Domains */}
            <div className="border border-[#37425B] rounded-lg p-3">
              <div className="font-semibold mb-2">Domains</div>
              {confirmedDomains.length === 0 ? (
                <div className="text-slate-400 text-sm">None</div>
              ) : (
                <ul className="space-y-2">
                  {confirmedDomains.map((d, idx) => {
                    const reasons = (d?.reasons || []).join(", ");
                    return (
                      <li key={idx} className="text-sm">
                        <span className="text-slate-200">{d.domain}</span>
                        {reasons && (
                          <div className="text-xs text-slate-400">
                            Reasons: {reasons}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Handles */}
            <div className="border border-[#37425B] rounded-lg p-3">
              <div className="font-semibold mb-2">Handles</div>
              {confirmedHandles.length === 0 ? (
                <div className="text-slate-400 text-sm">None</div>
              ) : (
                <ul className="space-y-2">
                  {confirmedHandles.map((h, idx) => {
                    const reasons = (h?.reasons || []).join(", ");
                    return (
                      <li key={idx} className="text-sm">
                        <span className="text-slate-200">{h.handle}</span>
                        <span className="text-slate-400">
                          {" "}
                          — confidence {Math.round((h.confidence || 0) * 100)}%
                        </span>
                        {reasons && (
                          <div className="text-xs text-slate-400">
                            Reasons: {reasons}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
