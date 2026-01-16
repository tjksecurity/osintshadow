import React from "react";
import { Gavel, Landmark, Fingerprint, ExternalLink, Car } from "lucide-react";

export function RecordsTab({ osint }) {
  const deeds = osint?.records?.property_deeds?.items || [];
  const deedsErrors = osint?.records?.property_deeds?.errors || [];

  const filings = osint?.records?.court_filings?.items || [];
  const filingsErrors = osint?.records?.court_filings?.errors || [];

  const criminal = osint?.records?.criminal?.items || [];
  const criminalErrors = osint?.records?.criminal?.errors || [];

  const plates = osint?.records?.license_plates?.items || [];
  const platesErrors = osint?.records?.license_plates?.errors || [];

  const riskChip = (level) => {
    const lvl = (level || "").toLowerCase();
    const cls =
      lvl === "high"
        ? "bg-red-500/15 text-red-200 border-red-500/30"
        : lvl === "medium"
          ? "bg-yellow-500/15 text-yellow-100 border-yellow-500/30"
          : "bg-green-500/15 text-green-200 border-green-500/30";

    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded border text-xs ${cls}`}
      >
        {level || "Low"}
      </span>
    );
  };

  const Section = ({ icon: Icon, title, children }) => (
    <section className="bg-[#2D384E] rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={18} className="text-[#00D1FF]" />
        <h3 className="font-semibold">{title}</h3>
      </div>
      {children}
    </section>
  );

  const Empty = ({ note }) => (
    <div className="text-slate-400 text-sm">{note || "No records found."}</div>
  );

  const ErrorList = ({ errors }) =>
    errors?.length ? (
      <div className="text-xs text-red-300 mt-2">
        {errors.map((e, i) => (
          <div key={i}>Error: {e}</div>
        ))}
      </div>
    ) : null;

  return (
    <div className="grid grid-cols-1 gap-4">
      <Section icon={Landmark} title="Property Deeds">
        {deeds.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-300">
                  <th className="text-left py-2 pr-3">Address</th>
                  <th className="text-left py-2 pr-3">Owner</th>
                  <th className="text-left py-2 pr-3">Last Sale</th>
                  <th className="text-left py-2 pr-3">Assessed</th>
                  <th className="text-left py-2 pr-3">Parcel</th>
                  <th className="text-left py-2 pr-3">Source</th>
                </tr>
              </thead>
              <tbody>
                {deeds.map((d, i) => (
                  <tr key={i} className="border-t border-[#37425B]">
                    <td className="py-2 pr-3">{d.address || "—"}</td>
                    <td className="py-2 pr-3">
                      {d.owner || "—"}
                      {d.owner2 ? `, ${d.owner2}` : ""}
                    </td>
                    <td className="py-2 pr-3">
                      {d.last_sale_date || "—"}
                      {d.last_sale_price ? ` · $${d.last_sale_price}` : ""}
                    </td>
                    <td className="py-2 pr-3">
                      {d.assessed_value ? `$${d.assessed_value}` : "—"}
                    </td>
                    <td className="py-2 pr-3">{d.parcel_number || "—"}</td>
                    <td className="py-2 pr-3">
                      {d.source?.url ? (
                        <a
                          className="text-[#00D1FF] inline-flex items-center gap-1"
                          href={d.source.url}
                          target="_blank"
                          rel="noopener"
                        >
                          {d.source.name || "Source"} <ExternalLink size={14} />
                        </a>
                      ) : (
                        d.source?.name || "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty note="Run an address investigation or enable Property deeds." />
        )}
        <ErrorList errors={deedsErrors} />
      </Section>

      <Section icon={Gavel} title="Legal & Litigation Footprint">
        {filings.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-300">
                  <th className="text-left py-2 pr-3">Case</th>
                  <th className="text-left py-2 pr-3">Court</th>
                  <th className="text-left py-2 pr-3">Filed</th>
                  <th className="text-left py-2 pr-3">Role</th>
                  <th className="text-left py-2 pr-3">Risk</th>
                  <th className="text-left py-2 pr-3">Source</th>
                  <th className="text-left py-2 pr-3">Link</th>
                </tr>
              </thead>
              <tbody>
                {filings.map((f, i) => (
                  <tr key={i} className="border-t border-[#37425B]">
                    <td className="py-2 pr-3">{f.case_name || "—"}</td>
                    <td className="py-2 pr-3">{f.court || "—"}</td>
                    <td className="py-2 pr-3">{f.date_filed || "—"}</td>
                    <td className="py-2 pr-3">{f.role || "—"}</td>
                    <td className="py-2 pr-3">
                      {f.risk_level ? riskChip(f.risk_level) : "—"}
                    </td>
                    <td className="py-2 pr-3">{f.source || "—"}</td>
                    <td className="py-2 pr-3">
                      {f.url ? (
                        <a
                          className="text-[#00D1FF] inline-flex items-center gap-1"
                          href={f.url}
                          target="_blank"
                          rel="noopener"
                        >
                          Open <ExternalLink size={14} />
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty note="Try running with a Full Name target and Court filings enabled." />
        )}
        <ErrorList errors={filingsErrors} />
      </Section>

      <Section icon={Fingerprint} title="Criminal Background (best‑effort)">
        {criminal.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-300">
                  <th className="text-left py-2 pr-3">Case</th>
                  <th className="text-left py-2 pr-3">Court</th>
                  <th className="text-left py-2 pr-3">Filed</th>
                  <th className="text-left py-2 pr-3">Docket</th>
                  <th className="text-left py-2 pr-3">Link</th>
                </tr>
              </thead>
              <tbody>
                {criminal.map((c, i) => (
                  <tr key={i} className="border-t border-[#37425B]">
                    <td className="py-2 pr-3">{c.case_name || "—"}</td>
                    <td className="py-2 pr-3">{c.court || "—"}</td>
                    <td className="py-2 pr-3">{c.date_filed || "—"}</td>
                    <td className="py-2 pr-3">{c.docket_number || "—"}</td>
                    <td className="py-2 pr-3">
                      {c.url ? (
                        <a
                          className="text-[#00D1FF] inline-flex items-center gap-1"
                          href={c.url}
                          target="_blank"
                          rel="noopener"
                        >
                          Open <ExternalLink size={14} />
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty note="Use a Full Name target for best results; coverage varies by jurisdiction." />
        )}
        <ErrorList errors={criminalErrors} />
      </Section>

      {/* NEW: License plates */}
      <Section icon={Car} title="License Plates">
        {plates.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-300">
                  <th className="text-left py-2 pr-3">Plate</th>
                  <th className="text-left py-2 pr-3">State</th>
                  <th className="text-left py-2 pr-3">VIN</th>
                  <th className="text-left py-2 pr-3">Year</th>
                  <th className="text-left py-2 pr-3">Make</th>
                  <th className="text-left py-2 pr-3">Model</th>
                  <th className="text-left py-2 pr-3">Color</th>
                  <th className="text-left py-2 pr-3">Registration</th>
                  <th className="text-left py-2 pr-3">Source</th>
                </tr>
              </thead>
              <tbody>
                {plates.map((p, i) => (
                  <tr key={i} className="border-t border-[#37425B]">
                    <td className="py-2 pr-3">{p.plate || "—"}</td>
                    <td className="py-2 pr-3">{p.state || "—"}</td>
                    <td className="py-2 pr-3">{p.vin || "—"}</td>
                    <td className="py-2 pr-3">{p?.vehicle?.year || "—"}</td>
                    <td className="py-2 pr-3">{p?.vehicle?.make || "—"}</td>
                    <td className="py-2 pr-3">{p?.vehicle?.model || "—"}</td>
                    <td className="py-2 pr-3">{p?.vehicle?.color || "—"}</td>
                    <td className="py-2 pr-3">
                      {p?.registration?.issued_on || p?.registration?.expires_on
                        ? `${p?.registration?.issued_on || ""}${
                            p?.registration?.expires_on
                              ? ` → ${p.registration.expires_on}`
                              : ""
                          }`
                        : "—"}
                    </td>
                    <td className="py-2 pr-3">
                      {p.source?.url ? (
                        <a
                          className="text-[#00D1FF] inline-flex items-center gap-1"
                          href={p.source.url}
                          target="_blank"
                          rel="noopener"
                        >
                          {p.source.name || "Source"} <ExternalLink size={14} />
                        </a>
                      ) : (
                        p.source?.name || "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty note="Run a License Plate investigation. Configure provider API keys in Settings." />
        )}
        <ErrorList errors={platesErrors} />
      </Section>
    </div>
  );
}

export default RecordsTab;
