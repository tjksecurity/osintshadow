import { escapeReportText as text, safeReportUrl } from '../../../../utils/reportSafety.js';
import { PUBLIC_SOURCES, safePublicSourceUrl } from '../../../../utils/publicSources.js';

function sourceLink(url, label = url) {
  const href = safeReportUrl(url);
  const content = text(label);
  return href
    ? `<a href="${text(href)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">${content}</a>`
    : content;
}

const rawData = (value) => text(JSON.stringify(value, null, 2));

function peopleDataLabsSection(result) {
  if (!result) return '';
  return `<div class="section"><h2>People Data Labs</h2>
    <p><strong>Status:</strong> ${text(result.status)}</p>
    <p>${text(result.message)}</p><p>Evaluated: ${text(result.checked_at)}</p>
    ${result.status === 'matched' && result.record ? `<p>Provider match likelihood: ${text(result.likelihood)}/10 (not independently verified identity or ownership)</p><pre>${rawData(result.record)}</pre>` : ''}
  </div>`;
}

function publicSourceSection(results) {
  if (!Array.isArray(results) || !results.length) return '';
  return `<div class="section"><h2>Public profile sources</h2><p>Candidates and validation signals only; not independently verified identity or ownership.</p>${results.map(result => `<div>
    <h3>${text(PUBLIC_SOURCES.find(source => source.id === result.provider)?.label || 'Public source')}</h3>
    <p>Status: ${text(result.status)}. ${text(result.message)}</p><p>Evaluated: ${text(result.evaluated_at)}</p>
    ${result.truncated ? '<p>Limited results; not an exhaustive search.</p>' : ''}
    ${result.status === 'candidates_found' && Array.isArray(result.records) ? `<ul>${result.records.slice(0,5).map(record => `<li>${sourceLink(safePublicSourceUrl(record.url), record.label)}<br>Source ID: ${text(record.id)}${record.context ? `<br>${text(record.context)}` : ''}</li>`).join('')}</ul>` : ''}
    ${result.status === 'validated' && typeof result.validation?.phone_valid === 'boolean' ? `<p>Provider number format/range validation: ${result.validation.phone_valid ? 'Valid' : 'Not valid'}. This does not verify activity or owner.</p><pre>${rawData(result.validation)}</pre>` : ''}
    </div>`).join('')}</div>`;
}

export function generateReportHTML(osintData, aiAnalysis) {
  const phoneCandidates = (osintData.phone_seeds || []).filter(
    (candidate) => candidate?.verification_status === "unverified_candidate",
  );

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>ShadowTrace Investigation Report</title>
      <meta name="referrer" content="no-referrer" />
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: http:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-src 'none'" />
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
        <p><strong>Target:</strong> ${text(osintData.target_value)} (${text(osintData.target_type)})</p>
        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
      </div>

      <div class="section">
        <h2>Executive Summary</h2>
        <p>${text(aiAnalysis.summary)}</p>
        <p><strong>Risk Score:</strong> <span class="risk-score">${text(aiAnalysis.risk_score)}/100</span> (${text(aiAnalysis.risk_level)})</p>
        <p><strong>Anomalies:</strong> ${text(aiAnalysis.anomalies || "None detected")}</p>
        ${aiAnalysis.presentation?.headline ? `<p><em>${text(aiAnalysis.presentation.headline)}</em></p>` : ""}
        ${
          Array.isArray(aiAnalysis.presentation?.highlights) &&
          aiAnalysis.presentation.highlights.length
            ? `
          <div>
            <h3>Key Findings</h3>
            <ul>
              ${aiAnalysis.presentation.highlights.map((h) => `<li>${text(h)}</li>`).join("")}
            </ul>
          </div>
        `
            : ""
        }
      </div>

      ${peopleDataLabsSection(osintData.people_data_labs)}
      ${publicSourceSection(osintData.public_sources)}

      <div class="section">
        <h2>Cross-Platform Identity Graph</h2>
        <p><strong>Emails:</strong> ${text((aiAnalysis.identity_graph?.emails || []).join(", ") || "-")}</p>
        <p><strong>Domains:</strong> ${text((aiAnalysis.identity_graph?.domains || []).join(", ") || "-")}</p>
        <p><strong>IPs:</strong> ${text((aiAnalysis.identity_graph?.ips || []).join(", ") || "-")}</p>
        <p><strong>Phone search targets (user-supplied; ownership is not verified):</strong> ${text((aiAnalysis.presentation?.phone_numbers || aiAnalysis.identity_graph?.phones || []).join(", ") || "-")}</p>
        <table>
          <thead><tr><th>Handle</th><th>Confidence</th><th>Platforms</th></tr></thead>
          <tbody>
            ${(aiAnalysis.identity_graph?.handles || [])
              .map(
                (h) => `
              <tr>
                <td>${text(h.handle)}</td>
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
                    return `${sourceLink(p.profile_url, p.platform)}${badge}`;
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
                `<li>${sourceLink(p.url, p.platform)} ${typeof p.confidence === "number" ? `- ${Math.round(p.confidence * 100)}%` : ""}</li>`,
            )
            .join("")}
        </ul>
      </div>
      `
          : ""
      }

      ${
        phoneCandidates.length
          ? `
      <div class="section">
        <h2>Public-page Phone Candidates (Unverified)</h2>
        <p>These are syntax-validated public-page observations, not verified ownership or identity findings.</p>
        <table>
          <thead><tr><th>Number</th><th>How observed</th><th>Source</th></tr></thead>
          <tbody>
            ${phoneCandidates
              .map(
                (p) =>
                  `<tr><td>${text(p.display)}</td><td>${text(p.extraction_method || "public page")}</td><td>${sourceLink(p.source_url)}</td></tr>`,
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
                  `<tr><td>${text(e.email)}</td><td>${sourceLink(e.source_url)}</td></tr>`,
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
                  ? sourceLink(d.source.url, d.source.name || "Source")
                  : text(d.source?.name || "-");
                return `<tr><td>${text(d.address || "-")}</td><td>${text(owners || "-")}</td><td>${text(sale || "-")}</td><td>${text(d.assessed_value ? `$${d.assessed_value}` : "-")}</td><td>${text(d.parcel_number || "-")}</td><td>${source}</td></tr>`;
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
                  `<tr><td>${text(f.case_name || "-")}</td><td>${text(f.court || "-")}</td><td>${text(f.date_filed || "-")}</td><td>${text(f.docket_number || "-")}</td><td>${f.url ? sourceLink(f.url, "Open") : "-"}</td></tr>`,
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
                  `<tr><td>${text(c.case_name || "-")}</td><td>${text(c.court || "-")}</td><td>${text(c.date_filed || "-")}</td><td>${text(c.docket_number || "-")}</td><td>${c.url ? sourceLink(c.url, "Open") : "-"}</td></tr>`,
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
                  ? sourceLink(p.source.url, p.source.name || "Source")
                  : text(p.source?.name || "-");
                return `<tr><td>${text(p.plate || "-")}</td><td>${text(p.state || "-")}</td><td>${text(p.vin || "-")}</td><td>${text(p?.vehicle?.year || "-")}</td><td>${text(p?.vehicle?.make || "-")}</td><td>${text(p?.vehicle?.model || "-")}</td><td>${text(p?.vehicle?.color || "-")}</td><td>${text(regStr)}</td><td>${source}</td></tr>`;
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
              const imageUrl = safeReportUrl(url);
              const hasExif = it?.exif?.has_exif ? "EXIF" : "No EXIF";
              const g = it?.reverse_search?.google;
              const b = it?.reverse_search?.bing;
              const y = it?.reverse_search?.yandex;
              return `
              <div class="img-card">
                ${imageUrl ? `<a href="${text(imageUrl)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer"><img src="${text(imageUrl)}" alt="Recovered" referrerpolicy="no-referrer" /></a>` : '<div>Image URL unavailable</div>'}
                <div class="img-meta">
                  <div>${sourceLink(url)}</div>
                  <div>${hasExif}</div>
                  <div>
                    ${g ? sourceLink(g, "Google") : ""}
                    ${b ? ` · ${sourceLink(b, "Bing")}` : ""}
                    ${y ? ` · ${sourceLink(y, "Yandex")}` : ""}
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
          <code>${rawData(osintData.email)}</code>
        </details>
        <details><summary>Username Intelligence</summary>
          <code>${rawData(osintData.username)}</code>
        </details>
        <details><summary>Phone Intelligence</summary>
          <code>${rawData(osintData.phone)}</code>
        </details>
        <details><summary>Domain & Web Intelligence</summary>
          <code>${rawData(osintData.domain)}</code>
        </details>
        <details><summary>IP & Network Intelligence</summary>
          <code>${rawData(osintData.ip_network)}</code>
        </details>
        <details><summary>Social Enrichment</summary>
          <code>${rawData(osintData.social)}</code>
        </details>
        <details><summary>Images</summary>
          <code>${rawData(osintData.images)}</code>
        </details>
        <details><summary>Documents</summary>
          <code>${rawData(osintData.documents)}</code>
        </details>
        <details><summary>Crypto</summary>
          <code>${rawData(osintData.crypto)}</code>
        </details>
        <details><summary>Records</summary>
          <code>${rawData(osintData.records)}</code>
        </details>
      </div>
    </body>
    </html>
  `;
}
