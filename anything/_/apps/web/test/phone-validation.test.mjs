import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  extractPhoneCandidatesFromHtml,
  normalizePhoneCandidate,
} from "../src/app/api/investigations/osint/phoneValidation.js";
import { phoneIntel, reversePhoneWebScan } from "../src/app/api/investigations/osint/phone.js";
import { buildIdentityGraph } from "../src/app/api/investigations/analysis/identity/identityGraph.js";
import { generateReportHTML } from "../src/app/api/investigations/reports/generator.js";

test("phone extraction rejects bare IDs and date-like numeric strings", () => {
  const candidates = extractPhoneCandidatesFromHtml(`
    <p>Order 1234567890</p>
    <p>Generated 2024010112</p>
    <p>Phone: (202) 555-0175</p>
    <a href="tel:+442079460958">Call</a>
  `);

  assert.deepEqual(
    new Set(candidates.map((candidate) => candidate.digits)),
    new Set(["2025550175", "442079460958"]),
  );
  const contextual = candidates.find((candidate) => candidate.digits === "2025550175");
  const telLink = candidates.find((candidate) => candidate.digits === "442079460958");
  assert.equal(contextual.verification_status, "unverified_candidate");
  assert.equal(contextual.extraction_method, "contact_context");
  assert.equal(telLink.extraction_method, "tel_link");
});

test("local syntax validation is not ownership validation and blocks bad targets from lookup", async () => {
  assert.equal(normalizePhoneCandidate("2025550175", { allow_bare_input: true })?.digits, "2025550175");
  assert.equal(normalizePhoneCandidate("2024010112", { allow_bare_input: true }), null);

  const valid = await phoneIntel("202-555-0175");
  assert.equal(valid.format_valid, true);
  assert.equal(valid.validation_status, "syntax_valid_unverified_target");
  assert.equal(valid.normalized, "+12025550175");

  const invalid = await phoneIntel("2024010112");
  assert.equal(invalid.format_valid, false);
  assert.equal(invalid.validation_status, "invalid_or_ambiguous_input");
  assert.equal(invalid.normalized, null);

  const lookup = await reversePhoneWebScan("2024010112");
  assert.equal(lookup.validation_error, "Phone input did not pass local syntax validation.");
  assert.deepEqual(lookup.query_variants, []);
});

test("public phone candidates retain uncertainty and cannot become graph phone findings", () => {
  const candidate = {
    display: "(202) 555-0175",
    digits: "2025550175",
    source_url: "https://example.test/contact",
    extraction_method: "contact_context",
    verification_status: "unverified_candidate",
  };
  const graph = buildIdentityGraph(
    { target_type: "email", target_value: "user@example.test" },
    "user@example.test",
    "user",
    "example.test",
    [candidate],
    {},
    {},
    {},
    {},
    { aggregate: { phones: [candidate] } },
    [],
  );

  assert.deepEqual(graph.phones, []);
  assert.deepEqual(graph.phone_candidates, [candidate]);
  assert.equal(graph.links.some((link) => link.target.includes("2025550175")), false);
});

test("reports label observed candidates and phone targets without asserting identity", () => {
  const html = generateReportHTML(
    {
      target_type: "email",
      target_value: "user@example.test",
      phone_seeds: [
        {
          display: "1234567890",
          digits: "1234567890",
          source_url: "https://example.test/legacy",
        },
        {
          display: "(202) 555-0175",
          digits: "2025550175",
          source_url: "https://example.test/contact",
          extraction_method: "contact_context",
          verification_status: "unverified_candidate",
        },
      ],
    },
    {
      summary: "Synthetic regression fixture",
      risk_score: 0,
      risk_level: "low",
      identity_graph: { emails: [], domains: [], ips: [], phones: [], handles: [] },
      presentation: { phone_numbers: [], highlights: [] },
    },
  );

  assert.match(html, /Public-page Phone Candidates \(Unverified\)/);
  assert.match(html, /not verified ownership or identity findings/);
  assert.match(html, /Phone search targets \(user-supplied; ownership is not verified\)/);
  assert.doesNotMatch(html, /Phone Numbers Discovered \(Seeds\)/);
  assert.doesNotMatch(html, />1234567890</);
});

test("investigation creation rejects invalid phone input before credit processing", async () => {
  const route = await readFile(
    new URL("../src/app/api/investigations/route.js", import.meta.url),
    "utf8",
  );
  const validationIndex = route.indexOf("INVALID_PHONE_TARGET");
  const creditCheckIndex = route.indexOf("let userCheckResult");
  assert.ok(validationIndex > -1);
  assert.ok(creditCheckIndex > validationIndex);
  assert.match(route, /normalizePhoneCandidate\(target_value, \{ allow_bare_input: true \}\)/);
});
