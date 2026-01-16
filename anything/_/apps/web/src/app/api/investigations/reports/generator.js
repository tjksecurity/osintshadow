export function generateReportHTML(osintData, aiAnalysis) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>ShadowTrace Investigation Report</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { border-bottom: 2px solid #00D1FF; padding-bottom: 20px; margin-bottom: 30px; }
        .section { margin-bottom: 30px; }
        .risk-score { font-size: 24px; font-weight: bold; color: ${aiAnalysis.risk_score > 70 ? "#ff4444" : aiAnalysis.risk_score > 40 ? "#ffaa00" : "#44ff44"}; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f2f2f2; }
        code { white-space: pre-wrap; }
        .pill { display:inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 12px; margin-right: 6px; }
        .pill-low { background:#E6F4EA; color:#1E7E34; }
        .pill-med { background:#FFF4E5; color:#996600; }
        .pill-high { background:#FDECEA; color:#A4000F; }
        .pill-evidence { background:#E5F0FF; color:#1A56DB; }
        ul { padding-left: 20px; }
        details { margin: 12px 0; }
        summary { cursor: pointer; font-weight: bold; }
        /* NEW: simple image grid */
        .img-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
        .img-card { border: 1px solid #ddd; border-radius: 8px; overflow: hidden; }
        .img-card img { width: 100%; height: 140px; object-fit: cover; display: block; background: #f7f7f7; }
        .img-meta { padding: 8px; font-size: 12px; }
        .img-meta a { color: #1A56DB; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>ShadowTrace OSINT Investigation Report</h1>
        <p><strong>Target:</strong> ${osintData.target_value} (${osintData.target_type})</p>
        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
      </div>

      <div class="section">
        <h2>Executive Summary</h2>
        <p>${aiAnalysis.summary}</p>
        <p><strong>Risk Score:</strong> <span class="risk-score">${aiAnalysis.risk_score}/100</span> (${aiAnalysis.risk_level})</p>
        <p><strong>Anomalies:</strong> ${aiAnalysis.anomalies || "None detected"}</p>
        ${aiAnalysis.presentation?.headline ? `<p><em>${aiAnalysis.presentation.headline}</em></p>` : ""}
        ${
          Array.isArray(aiAnalysis.presentation?.highlights) &&
          aiAnalysis.presentation.highlights.length
            ? `
          <div>
            <h3>Key Findings</h3>
            <ul>
              ${aiAnalysis.presentation.highlights.map((h) => `<li>${h}</li>`).join("")}
            </ul>
          </div>
        `
            : ""
        }
      </div>

      <div class="section">
        <h2>Cross-Platform Identity Graph</h2>
        <p><strong>Emails:</strong> ${(aiAnalysis.identity_graph?.emails || []).join(", ") || "—"}</p>
        <p><strong>Domains:</strong> ${(aiAnalysis.identity_graph?.domains || []).join(", ") || "—"}</p>
        <p><strong>IPs:</strong> ${(aiAnalysis.identity_graph?.ips || []).join(", ") || "—"}</p>
        <p><strong>Phones:</strong> ${(aiAnalysis.presentation?.phone_numbers || aiAnalysis.identity_graph?.phones || []).join(", ") || "—"}</p>
        <table>
          <thead><tr><th>Handle</th><th>Confidence</th><th>Platforms</th></tr></thead>
          <tbody>
            ${(aiAnalysis.identity_graph?.handles || [])
              .map(
                (h) => `
              <tr>
                <td>${h.handle}</td>
                <td>${Math.round((h.confidence || 0) * 100)}%</td>
                <td>${(h.platforms || [])
                  .map((p) => {
                    const hasEvidence = !!(
                      p.match_evidence &&
                      Object.values(p.match_evidence).some(
                        (arr) => (arr || []).length > 0,
                      )
                    );
                    const badge = hasEvidence
                      ? ' <span class="pill pill-evidence">Evidence-backed</span>'
                      : "";
                    return `<a href="${p.profile_url}" target="_blank" rel="noopener">${p.platform}</a>${badge}`;
                  })
                  .join(", ")}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </div>

      ${
        Array.isArray(aiAnalysis.presentation?.evidence_profiles) &&
        aiAnalysis.presentation.evidence_profiles.length
          ? `
      <div class="section">
        <h2>Profiles with On-page Evidence</h2>
        <ul>
          ${aiAnalysis.presentation.evidence_profiles
            .map(
              (p) =>
                `<li><a href="${p.url}" target="_blank" rel="noopener">${p.platform}</a> ${typeof p.confidence === "number" ? `— ${Math.round(p.confidence * 100)}%` : ""}</li>`,
            )
            .join("")}
        </ul>
      </div>
      `
          : ""
      }

      ${
        Array.isArray(osintData.phone_seeds) && osintData.phone_seeds.length
          ? `
      <div class="section">
        <h2>Phone Numbers Discovered (Seeds)</h2>
        <table>
          <thead><tr><th>Number</th><th>Source</th></tr></thead>
          <tbody>
            ${osintData.phone_seeds
              .map(
                (p) =>
                  `<tr><td>${p.display}</td><td><a href="${p.source_url}" target="_blank" rel="noopener">${p.source_url}</a></td></tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>
      `
          : ""
      }

      ${
        Array.isArray(osintData.email_seeds) && osintData.email_seeds.length
          ? `
      <div class="section">
        <h2>Email Addresses Discovered (Seeds)</h2>
        <table>
          <thead><tr><th>Email</th><th>Source</th></tr></thead>
          <tbody>
            ${osintData.email_seeds
              .map(
                (e) =>
                  `<tr><td>${e.email}</td><td><a href="${e.source_url}" target="_blank" rel="noopener">${e.source_url}</a></td></tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>
      `
          : ""
      }

      ${
        Array.isArray(osintData.records?.property_deeds?.items) &&
        osintData.records.property_deeds.items.length
          ? `
      <div class="section">
        <h2>Property Records</h2>
        <table>
          <thead><tr><th>Address</th><th>Owner(s)</th><th>Last Sale</th><th>Assessed</th><th>Parcel</th><th>Source</th></tr></thead>
          <tbody>
            ${osintData.records.property_deeds.items
              .map((d) => {
                const owners = [d.owner, d.owner2].filter(Boolean).join(", ");
                const sale = [
                  d.last_sale_date,
                  d.last_sale_price ? `$${d.last_sale_price}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                const source = d.source?.url
                  ? `<a href="${d.source.url}" target="_blank" rel="noopener">${d.source.name || "Source"}</a>`
                  : d.source?.name || "—";
                return `<tr><td>${d.address || "—"}</td><td>${owners || "—"}</td><td>${sale || "—"}</td><td>${d.assessed_value ? `$${d.assessed_value}` : "—"}</td><td>${d.parcel_number || "—"}</td><td>${source}</td></tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
      `
          : ""
      }

      ${
        Array.isArray(osintData.records?.court_filings?.items) &&
        osintData.records.court_filings.items.length
          ? `
      <div class="section">
        <h2>Court Filings</h2>
        <table>
          <thead><tr><th>Case</th><th>Court</th><th>Filed</th><th>Docket</th><th>Link</th></tr></thead>
          <tbody>
            ${osintData.records.court_filings.items
              .map(
                (f) =>
                  `<tr><td>${f.case_name || "—"}</td><td>${f.court || "—"}</td><td>${f.date_filed || "—"}</td><td>${f.docket_number || "—"}</td><td>${f.url ? `<a href="${f.url}" target="_blank" rel="noopener">Open</a>` : "—"}</td></tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>
      `
          : ""
      }

      ${
        Array.isArray(osintData.records?.criminal?.items) &&
        osintData.records.criminal.items.length
          ? `
      <div class="section">
        <h2>Criminal Background (best‑effort)</h2>
        <table>
          <thead><tr><th>Case</th><th>Court</th><th>Filed</th><th>Docket</th><th>Link</th></tr></thead>
          <tbody>
            ${osintData.records.criminal.items
              .map(
                (c) =>
                  `<tr><td>${c.case_name || "—"}</td><td>${c.court || "—"}</td><td>${c.date_filed || "—"}</td><td>${c.docket_number || "—"}</td><td>${c.url ? `<a href="${c.url}" target="_blank" rel="noopener">Open</a>` : "—"}</td></tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>
      `
          : ""
      }

      ${
        Array.isArray(osintData.records?.license_plates?.items) &&
        osintData.records.license_plates.items.length
          ? `
      <div class="section">
        <h2>License Plates</h2>
        <table>
          <thead><tr><th>Plate</th><th>State</th><th>VIN</th><th>Year</th><th>Make</th><th>Model</th><th>Color</th><th>Registration</th><th>Source</th></tr></thead>
          <tbody>
            ${osintData.records.license_plates.items
              .map((p) => {
                const reg = p?.registration;
                const regStr =
                  reg?.issued_on || reg?.expires_on
                    ? `${reg?.issued_on || ""}${reg?.expires_on ? ` → ${reg.expires_on}` : ""}`
                    : "—";
                const source = p.source?.url
                  ? `<a href="${p.source.url}" target="_blank" rel="noopener">${p.source.name || "Source"}</a>`
                  : p.source?.name || "—";
                return `<tr><td>${p.plate || "—"}</td><td>${p.state || "—"}</td><td>${p.vin || "—"}</td><td>${p?.vehicle?.year || "—"}</td><td>${p?.vehicle?.make || "—"}</td><td>${p?.vehicle?.model || "—"}</td><td>${p?.vehicle?.color || "—"}</td><td>${regStr}</td><td>${source}</td></tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
      `
          : ""
      }

      ${
        Array.isArray(osintData.images?.items) && osintData.images.items.length
          ? `
      <div class="section">
        <h2>Images Recovered</h2>
        <div class="img-grid">
          ${osintData.images.items
            .map((it) => {
              const url = it.url;
              const hasExif = it?.exif?.has_exif ? "EXIF" : "No EXIF";
              const g = it?.reverse_search?.google;
              const b = it?.reverse_search?.bing;
              const y = it?.reverse_search?.yandex;
              return `
              <div class="img-card">
                <a href="${url}" target="_blank" rel="noopener">
                  <img src="${url}" alt="Recovered" />
                </a>
                <div class="img-meta">
                  <div><a href="${url}" target="_blank" rel="noopener">${url}</a></div>
                  <div>${hasExif}</div>
                  <div>
                    ${g ? `<a href="${g}" target="_blank" rel="noopener">Google</a>` : ""}
                    ${b ? ` · <a href="${b}" target="_blank" rel="noopener">Bing</a>` : ""}
                    ${y ? ` · <a href="${y}" target="_blank" rel="noopener">Yandex</a>` : ""}
                  </div>
                </div>
              </div>`;
            })
            .join("")}
        </div>
      </div>
      `
          : ""
      }

      <div class="section">
        <h2>Raw Data (expand to view)</h2>
        <details><summary>Email Intelligence</summary>
          <code>${JSON.stringify(osintData.email, null, 2)}</code>
        </details>
        <details><summary>Username Intelligence</summary>
          <code>${JSON.stringify(osintData.username, null, 2)}</code>
        </details>
        <details><summary>Phone Intelligence</summary>
          <code>${JSON.stringify(osintData.phone, null, 2)}</code>
        </details>
        <details><summary>Domain & Web Intelligence</summary>
          <code>${JSON.stringify(osintData.domain, null, 2)}</code>
        </details>
        <details><summary>IP & Network Intelligence</summary>
          <code>${JSON.stringify(osintData.ip_network, null, 2)}</code>
        </details>
        <details><summary>Social Enrichment</summary>
          <code>${JSON.stringify(osintData.social, null, 2)}</code>
        </details>
        <details><summary>Images</summary>
          <code>${JSON.stringify(osintData.images, null, 2)}</code>
        </details>
        <details><summary>Documents</summary>
          <code>${JSON.stringify(osintData.documents, null, 2)}</code>
        </details>
        <details><summary>Crypto</summary>
          <code>${JSON.stringify(osintData.crypto, null, 2)}</code>
        </details>
        <details><summary>Records</summary>
          <code>${JSON.stringify(osintData.records, null, 2)}</code>
        </details>
      </div>
    </body>
    </html>
  `;
}
