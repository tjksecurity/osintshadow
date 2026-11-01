import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { generateReportHTML } from '../src/app/api/investigations/reports/generator.js';
import { escapeReportText, safeReportUrl } from '../src/utils/reportSafety.js';

test('URL validation permits HTTP(S) provenance and explicit app-relative exports only', () => {
  assert.equal(escapeReportText('<em title="synthetic">A&B\'s</em>'), '&lt;em title=&quot;synthetic&quot;&gt;A&amp;B&#39;s&lt;/em&gt;');
  assert.equal(safeReportUrl('https://example.invalid/source?a=1&b=2'), 'https://example.invalid/source?a=1&b=2');
  assert.equal(safeReportUrl('http://example.invalid/source'), 'http://example.invalid/source');
  assert.equal(safeReportUrl('/exports/report.pdf?one=1&two=2', { allowRelative: true }), '/exports/report.pdf?one=1&two=2');
  assert.equal(safeReportUrl('/exports/report.pdf'), null);
  for (const url of ['javascript:synthetic', 'data:text/html,synthetic', '//example.invalid', '/\\example.invalid', 'java\tscript:synthetic', 'file:///synthetic', 'https://user:secret@example.invalid/']) {
    assert.equal(safeReportUrl(url, { allowRelative: true }), null);
  }
});

function fixture() {
  const raw = [];
  const value = (label) => {
    const marker = `<em data-synthetic="${label}">${label} & "quoted"</em>`;
    raw.push(marker);
    return marker;
  };
  const osint = {
    target_value: value('target'), target_type: value('type'),
    email: { [value('raw-key')]: value('raw-value') },
    email_seeds: [{ email: value('email'), source_url: 'https://example.invalid/email?one=1&two=2' }],
    phone_seeds: [{ display: value('phone'), extraction_method: value('method'), source_url: 'https://example.invalid/phone', verification_status: 'unverified_candidate' }],
    records: {
      property_deeds: { items: [{ address: value('address'), owner: value('owner'), owner2: value('owner2'), last_sale_date: value('sale-date'), last_sale_price: value('sale-price'), assessed_value: value('assessed'), parcel_number: value('parcel'), source: { name: value('property-source'), url: 'https://example.invalid/property' } }] },
      court_filings: { items: [{ case_name: value('case'), court: value('court'), date_filed: value('filed'), docket_number: value('docket'), url: 'https://example.invalid/court' }] },
      criminal: { items: [{ case_name: value('criminal-case'), court: value('criminal-court'), date_filed: value('criminal-filed'), docket_number: value('criminal-docket'), url: 'https://example.invalid/case' }] },
      license_plates: { items: [{ plate: value('plate'), state: value('state'), vin: value('vin'), vehicle: { year: value('year'), make: value('make'), model: value('model'), color: value('color') }, registration: { issued_on: value('issued'), expires_on: value('expires') }, source: { name: value('plate-source'), url: 'https://example.invalid/plate' } }] },
    },
    images: { items: [{ url: 'https://example.invalid/image?one=1&two=2', reverse_search: { google: 'https://example.invalid/google', bing: 'https://example.invalid/bing', yandex: 'https://example.invalid/yandex' } }] },
  };
  const analysis = {
    summary: value('summary'), risk_score: value('score'), risk_level: value('risk'), anomalies: value('anomalies'),
    presentation: { headline: value('headline'), highlights: [value('highlight')], phone_numbers: [value('phone-target')], evidence_profiles: [{ platform: value('evidence-platform'), url: 'https://example.invalid/evidence' }] },
    identity_graph: { emails: [value('graph-email')], domains: [value('graph-domain')], ips: [value('graph-ip')], handles: [{ handle: value('handle'), confidence: 0.2, platforms: [{ platform: value('platform'), profile_url: 'https://example.invalid/profile' }] }] },
  };
  return { osint, analysis, raw };
}

test('report escapes text, attributes and raw JSON across every retained section', () => {
  const { osint, analysis, raw } = fixture();
  const html = generateReportHTML(osint, analysis);
  for (const marker of raw) assert.ok(!html.includes(marker), `Unescaped report marker: ${marker}`);
  assert.match(html, /&lt;em data-synthetic=&quot;target&quot;&gt;target &amp; &quot;quoted&quot;&lt;\/em&gt;/);
  assert.match(html, /&lt;em data-synthetic=\\&quot;raw-key/);
  for (const section of ['Executive Summary', 'Cross-Platform Identity Graph', 'Property Records', 'Court Filings', 'Criminal Background', 'License Plates', 'Images Recovered', 'Raw Data']) assert.ok(html.includes(section));
  assert.match(html, /Phone search targets \(user-supplied; ownership is not verified\)/);
  assert.match(html, /Public-page Phone Candidates \(Unverified\)/);
  assert.match(html, /not verified ownership or identity findings/);
  assert.match(html, /href="https:\/\/example\.invalid\/email\?one=1&amp;two=2"/);
});

test('report rejects executable and malformed URL schemes without losing source text', () => {
  const urls = ['javascript:synthetic', 'jAvAsCrIpT:synthetic', 'java\nscript:synthetic', 'data:text/html,synthetic', 'data:image/svg+xml,synthetic', 'vbscript:synthetic', '//example.invalid/protocol-relative', 'https://example.invalid/" onload="synthetic'];
  const html = generateReportHTML({
    target_type: 'domain', target_value: 'example.invalid',
    email_seeds: urls.map(source_url => ({ email: 'synthetic@example.invalid', source_url })),
    images: { items: urls.map(url => ({ url, reverse_search: { google: url, bing: url, yandex: url } })) },
  }, { summary: 'Synthetic report.', risk_score: 0, risk_level: 'low', identity_graph: { handles: urls.map(profile_url => ({ handle: 'synthetic', platforms: [{ platform: 'source', profile_url }] })) } });
  assert.doesNotMatch(html, /(?:href|src)="(?:javascript|data|vbscript):/i);
  assert.doesNotMatch(html, /(?:href|src)="\/\//);
  assert.doesNotMatch(html, /" onload="synthetic/);
  assert.ok(html.includes('javascript:synthetic'), 'Unsafe source values should remain inspectable as inert text.');
  assert.match(html, /http-equiv="Content-Security-Policy"/);
  assert.match(html, /default-src 'none'/);
});

test('report iframe denies script/same-origin privileges and preserves safe PDF downloads', async () => {
  const source = await readFile(new URL('../src/components/InvestigationDetail/ReportTab.jsx', import.meta.url), 'utf8');
  const frame = source.match(/<iframe[\s\S]*?\/>/)?.[0];
  assert.ok(frame);
  assert.match(frame, /sandbox="[^"]*"/);
  assert.doesNotMatch(frame, /allow-scripts|allow-same-origin/);
  assert.match(frame, /referrerPolicy="no-referrer"/);
  assert.match(source, /safeReportUrl\(investigation\.pdf_url, \{ allowRelative: true \}\)/);
});
