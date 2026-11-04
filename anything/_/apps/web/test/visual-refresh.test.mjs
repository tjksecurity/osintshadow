import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { installScrollExperience } from '../src/components/Landing/scrollExperience.js';

// Actual page/component render with synthetic account records; effects do not run
// during SSR. This deliberately does not authenticate or exercise live services.
const iconNames = ['ArrowRight','ArrowUpRight','ChevronDown','Check','Menu','X','Search','Network','FileText','Shield','Fingerprint','Globe','Bell','User','LayoutDashboard','FileBarChart','Map','CreditCard','Settings','Plus','TrendingUp','Activity','AlertTriangle','CheckCircle','Clock','XCircle','Sparkles'];
const icons = Object.fromEntries(iconNames.map(name => [name, props => React.createElement('svg', { 'data-icon': name, 'aria-hidden': props['aria-hidden'] ?? 'true' })]));
async function load(relative, bindings = {}) {
  let source = await readFile(new URL(relative, import.meta.url), 'utf8');
  source = source.replace(/^import[\s\S]*?from ["'][^"']+["'];?\s*/gm, '').replace(/^import ["'][^"']+["'];?\s*/gm, '');
  const compiled = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  assert.equal(compiled.diagnostics?.filter(item => item.category === ts.DiagnosticCategory.Error).length ?? 0, 0, relative);
  const key = '__visual_' + randomUUID();
  globalThis[key] = { React, useState: React.useState, useEffect: React.useEffect, useRef: React.useRef, ...icons, ...bindings };
  const body = `const { ${Object.keys(globalThis[key]).join(', ')} } = globalThis[${JSON.stringify(key)}];\n${compiled.outputText}`;
  try { return await import('data:text/javascript;base64,' + Buffer.from(body).toString('base64')); }
  finally { delete globalThis[key]; }
}
const { default: BrandLogo } = await load('../src/components/BrandLogo.jsx');
const { default: LandingPage } = await load('../src/components/Landing/LandingPage.jsx', { BrandLogo, installScrollExperience });
const { DashboardView, filterInvestigationRows } = await load('../src/app/dashboard/page.jsx', { BrandLogo });
const render = (Component, props = {}) => renderToStaticMarkup(React.createElement(Component, props));

test('landing renders one clear h1, semantic landmarks, original logo, valid local anchors', () => {
  const html = render(LandingPage);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /Find the signal/);
  for (const element of ['header','main','footer','nav']) assert.match(html, new RegExp('<' + element + '\\b'));
  assert.match(html, /aria-label="ShadowTrace"/);
  for (const [, anchor] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(html.includes(`id="${anchor}"`), anchor);
  assert.match(html, /Skip to content/);
});

test('original prices and each existing plan feature remain present', () => {
  const html = render(LandingPage);
  for (const amount of ['$49','$99','$249']) assert.ok(html.includes(amount));
  for (const text of ['10 investigations per month','50 investigations per month','200 investigations per month','Basic OSINT collection','AI risk analysis','PDF reports','Advanced OSINT collection','Enhanced AI analysis','PDF &amp; HTML reports','Map visualization','Premium OSINT sources','Advanced AI correlation','Custom report branding','API access']) assert.ok(html.includes(text), text);
});

test('landing avoids fabricated adoption, testimonial, live-result and guaranteed identity claims', () => {
  const html = render(LandingPage);
  assert.match(html, /Illustrative workflow/);
  assert.match(html, /not live investigation data/);
  assert.match(html, /not a verified identity/);
  assert.doesNotMatch(html, /thousands of investigators|trusted by|99\.9%|guaranteed identity/i);
  assert.doesNotMatch(html, /<iframe|<img|src="https?:/);
});

test('mobile navigation starts closed, exposes controls, and native FAQ remains keyboard operable', () => {
  const html = render(LandingPage);
  assert.match(html, /aria-expanded="false" aria-controls="st-mobile-navigation"/);
  assert.match(html, /id="st-mobile-navigation"[^>]+hidden=""/);
  assert.equal((html.match(/<details\b/g) || []).length, 4);
  assert.equal((html.match(/<summary\b/g) || []).length, 4);
});

test('public landing content does not disappear while session loading; existing redirect retained', async () => {
  const effects = [];
  const { default: HomePage } = await load('../src/app/page.jsx', { useUser: () => ({ data: null, loading: true }), useEffect: (...args) => effects.push(args), LandingPage });
  assert.match(render(HomePage), /Find the signal/);
  assert.equal(effects.length, 1);
  const source = await readFile(new URL('../src/app/page.jsx', import.meta.url), 'utf8');
  assert.match(source, /!loading && user/);
  assert.match(source, /window.location.href = '\/dashboard'/);
});

const record = { id: 71, target_value: 'synthetic.example.invalid', target_type: 'domain', status: 'completed', risk_score: 0, created_at: '2026-11-04T12:00:00Z' };
const props = { user: { name: 'Synthetic account' }, credits: { credits_unlimited: true, monthly_remaining: 0 }, investigations: [record], stats: { total: 1, completed: 1, processing: 0 } };

test('dashboard renders actual fixture rows, zero score and unlimited entitlement without fabricated metrics', () => {
  const html = render(DashboardView, props);
  assert.match(html, /Unlimited/);
  assert.match(html, /synthetic.example.invalid/);
  assert.match(html, /0\/100/);
  assert.match(html, /Latest 10 investigations/);
  assert.match(html, /href="\/investigations\/71"/);
  assert.doesNotMatch(html, /upgrade|thousands|Total Investigations/);
});

test('recent-list filter searches target/type/status without new network calls', () => {
  assert.equal(filterInvestigationRows([record], ' SYNTHETIC ').length, 1);
  assert.equal(filterInvestigationRows([record], 'domain').length, 1);
  assert.equal(filterInvestigationRows([record], 'completed').length, 1);
  assert.equal(filterInvestigationRows([record], 'other').length, 0);
  assert.match(render(DashboardView, { ...props, initialQuery: 'other' }), /No matching recent investigations/);
});

test('dashboard loading/error/empty states cannot masquerade as successful empty data', () => {
  assert.match(render(DashboardView, { listLoading: true }), /Loading your investigations/);
  assert.doesNotMatch(render(DashboardView, { listLoading: true }), /Every investigation starts/);
  assert.match(render(DashboardView, { listError: true }), /Your investigations are unavailable/);
  assert.match(render(DashboardView, {}), /Every investigation starts with a lead/);
  assert.match(render(DashboardView, { ...props, listError: true }), /Previously loaded results/);
  assert.match(render(DashboardView, { ...props, creditError: new Error('synthetic') }), /Unavailable/);
  assert.doesNotMatch(render(DashboardView, { ...props, creditError: new Error('synthetic') }), /Unlimited/);
});

test('dashboard escapes source/identity text and admin link remains gated', () => {
  const html = render(DashboardView, { ...props, user: { name: '<script>synthetic</script>' }, investigations: [{ ...record, target_value: '<img src=x onerror=bad()>' }] });
  assert.doesNotMatch(html, /<script>|<img src=x/);
  assert.match(html, /&lt;script&gt;synthetic/);
  assert.doesNotMatch(html, /href="\/administration"/);
  assert.match(render(DashboardView, { ...props, isAdmin: true }), /href="\/administration"/);
});

function scrollHarness(reduced = false) {
  const events = new Map(); const mediaEvents = new Map(); const observed = []; let callback; let animationCalls = 0; let cancelled = 0; let disconnected = 0; let frameCallback;
  const nodes = Array.from({ length: 2 }, () => ({ animate() { animationCalls++; return { cancel() { cancelled++; } }; } }));
  const progress = { style: {} };
  const preference = { matches: reduced, addEventListener: (name, fn) => mediaEvents.set(name, fn), removeEventListener: name => mediaEvents.delete(name) };
  const win = { matchMedia: () => preference, innerHeight: 600, scrollY: 300, IntersectionObserver: class { constructor(fn) { callback = fn; } observe(node) { observed.push(node); } unobserve() {} disconnect() { disconnected++; } }, requestAnimationFrame(fn) { frameCallback = fn; return 1; }, cancelAnimationFrame() {}, addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name) };
  const root = { scrollHeight: 1200, querySelector: () => progress, querySelectorAll: () => nodes };
  return { root, win, events, mediaEvents, observed, nodes, preference, progress, intersect: () => callback(nodes.map(target => ({ target, isIntersecting: true }))), frame: () => frameCallback(), counts: () => ({ animationCalls, cancelled, disconnected }) };
}

test('scroll reveal animates observed elements once and removes listeners on cleanup', () => {
  const h = scrollHarness(); const cleanup = installScrollExperience(h.root, h.win);
  assert.equal(h.observed.length, 2);
  assert.equal(h.progress.style.transform, 'scaleX(0.5)');
  h.intersect(); assert.equal(h.counts().animationCalls, 2);
  h.win.scrollY = 10000; h.events.get('scroll')(); h.frame();
  assert.equal(h.progress.style.transform, 'scaleX(1)');
  cleanup(); assert.equal(h.events.size, 0); assert.equal(h.mediaEvents.size, 0); assert.equal(h.counts().cancelled, 2);
});

test('reduced motion skips reveal animations and changing preference cancels active motion', () => {
  const reduced = scrollHarness(true); installScrollExperience(reduced.root, reduced.win)(); assert.equal(reduced.observed.length, 0);
  const h = scrollHarness(); const cleanup = installScrollExperience(h.root, h.win); h.intersect(); h.preference.matches = true; h.mediaEvents.get('change')();
  assert.equal(h.counts().cancelled, 2); cleanup();
});

test('CSS contains responsive layouts/focus/reduced motion and never hides content for scroll reveals', async () => {
  const css = await readFile(new URL('../src/components/Landing/shadowtrace.css', import.meta.url), 'utf8');
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /focus-visible/);
  assert.match(css, /max-width: 640px/);
  assert.match(css, /max-width: 900px/);
  assert.doesNotMatch(css, /\[data-reveal\][^{]*\{[^}]*opacity:\s*0/);
  assert.doesNotMatch(css, /@import|url\(https?:/);
});
