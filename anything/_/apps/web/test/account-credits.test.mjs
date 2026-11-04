import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { checkUserCredits } from '../src/app/api/investigations/utils/auth.js';

async function load(relative, bindings = {}, jsx = false) {
  let source = await readFile(new URL(relative, import.meta.url), 'utf8');
  source = source.replace(/^import[\s\S]*?from ["'][^"']+["'];?\s*/gm, '');
  if (jsx) source = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const key = '__credits_' + randomUUID();
  globalThis[key] = { React, ...bindings };
  source = `const { ${Object.keys(globalThis[key]).join(', ')} } = globalThis[${JSON.stringify(key)}];\n` + source;
  try { return await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64')); }
  finally { delete globalThis[key]; }
}

test('unlimited accounts never see a zero-balance upgrade warning', async () => {
  const { CreditsWarning } = await load('../src/components/NewInvestigation/CreditsWarning.jsx', {}, true);
  const html = renderToStaticMarkup(React.createElement(CreditsWarning, { monthlyRemaining: 0, unlimited: true }));
  assert.match(html, /Unlimited investigation credits/);
  assert.doesNotMatch(html, /no credits remaining|upgrade/i);
});

test('ordinary zero and low balances still display their warnings', async () => {
  const { CreditsWarning } = await load('../src/components/NewInvestigation/CreditsWarning.jsx', {}, true);
  assert.match(renderToStaticMarkup(React.createElement(CreditsWarning, { monthlyRemaining: 0 })), /no credits/);
  assert.match(renderToStaticMarkup(React.createElement(CreditsWarning, { monthlyRemaining: 2 })), /2 credits/);
});

test('an unlimited form is enabled at zero balance and never claims a debit', async () => {
  const empty = () => null;
  const { InvestigationForm } = await load('../src/components/NewInvestigation/InvestigationForm.jsx', {
    TargetTypeSelector: empty, TargetValueInput: empty, SearchOptions: empty, AdvancedOptions: empty,
    targetTypes: [{ value: 'domain', label: 'Domain' }],
  }, true);
  const html = renderToStaticMarkup(React.createElement(InvestigationForm, {
    targetType: 'domain', targetValue: 'example.invalid', user: { monthly_remaining: 0 },
    isAdmin: false, isTrial: false, hasUnlimitedCredits: true,
  }));
  assert.match(html, /Unlimited investigation credits/);
  assert.doesNotMatch(html, /disabled=""|use 1 credit|No credits remaining/);
});

test('existing owner entitlement comes from the database identity, not a requested email', async () => {
  for (const email of ['glossontravis@gmail.com', 'GLOSSONTRAVIS@GMAIL.COM']) {
    const result = await checkUserCredits(async (_parts, id) => {
      assert.equal(id, 'current-user');
      return [{ id, role: 'user', email, monthly_remaining: 0 }];
    }, 'current-user');
    assert.equal(result.hasCredits, true);
    assert.equal(result.isAdmin, true); // Existing backend policy, not a new role grant.
  }
  const ordinary = await checkUserCredits(async () => [{ role: 'user', email: 'ordinary@example.invalid', monthly_remaining: 0 }], 'current-user');
  assert.equal(ordinary.hasCredits, false);
});

async function creditsRoute({ session = { user: { id: 'current-user' } }, row = { id: 'current-user', email: 'glossontravis@gmail.com', role: 'user', monthly_remaining: 0, subscription_plan: null } } = {}) {
  let queries = 0;
  const loaded = await load('../src/app/api/user/credits/route.js', {
    auth: async () => session, checkUserCredits,
    sql: async (parts, ...values) => {
      queries++;
      assert.match(parts.join('?'), /WHERE id = \?/);
      assert.deepEqual(values, ['current-user']);
      return row ? [row] : [];
    },
  });
  return { call: () => loaded.GET(new Request('https://example.invalid/api/user/credits?user_id=other&unlimited=true')), queries: () => queries };
}

test('credit summary is current-user-only, non-cacheable and does not expose identity or grant admin roles', async () => {
  const h = await creditsRoute();
  const response = await h.call();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.deepEqual(await response.json(), { user_id: 'current-user', credits_unlimited: true, monthly_remaining: 0, is_trial: false });
  assert.equal(h.queries(), 1);
});

test('signed-out/missing accounts cannot read credit summaries', async () => {
  const signedOut = await creditsRoute({ session: null });
  assert.equal((await signedOut.call()).status, 401);
  assert.equal(signedOut.queries(), 0);
  assert.equal((await (await creditsRoute({ row: null })).call()).status, 404);
});

test('ordinary accounts cannot obtain unlimited credits through client query parameters', async () => {
  const h = await creditsRoute({ row: { id: 'current-user', email: 'ordinary@example.invalid', role: 'user', monthly_remaining: 0, subscription_plan: 'pro' } });
  assert.deepEqual(await (await h.call()).json(), { user_id: 'current-user', credits_unlimited: false, monthly_remaining: 0, is_trial: false });
});

test('trial accounts remain trial rather than being mislabeled unlimited', async () => {
  const h = await creditsRoute({ row: { id: 'current-user', email: 'trial@example.invalid', role: 'user', monthly_remaining: 0, subscription_plan: 'trial' } });
  assert.deepEqual(await (await h.call()).json(), { user_id: 'current-user', credits_unlimited: false, monthly_remaining: 0, is_trial: true });
});

test('ordinary zero-credit users cannot enable the form by passing isAdmin to the presentation component', async () => {
  const empty = () => null;
  const { InvestigationForm } = await load('../src/components/NewInvestigation/InvestigationForm.jsx', {
    TargetTypeSelector: empty, TargetValueInput: empty, SearchOptions: empty, AdvancedOptions: empty,
    targetTypes: [{ value: 'domain', label: 'Domain' }],
  }, true);
  const html = renderToStaticMarkup(React.createElement(InvestigationForm, {
    targetType: 'domain', targetValue: 'example.invalid', user: { monthly_remaining: 0 },
    isAdmin: true, isTrial: false, hasUnlimitedCredits: false,
  }));
  assert.match(html, /disabled=""/);
  assert.match(html, /No credits remaining/);
});

test('loading or failed entitlement reads cannot present zero credits as an upgrade requirement', async () => {
  const { CreditsWarning } = await load('../src/components/NewInvestigation/CreditsWarning.jsx', {}, true);
  for (const state of [{ loading: true }, { error: new Error('Synthetic transport failure') }]) {
    const html = renderToStaticMarkup(React.createElement(CreditsWarning, { monthlyRemaining: 0, ...state }));
    assert.doesNotMatch(html, /upgrade|no credits remaining/i);
  }
});

test('credit hook isolates account caches and rejects a response from a changed session', async () => {
  let options;
  const { useInvestigationCredits } = await load('../src/hooks/useInvestigationCredits.js', {
    useSession: () => ({ data: { user: { id: 'current-user' } }, status: 'authenticated' }),
    useQuery: input => { options = input; return {}; },
    fetch: async () => Response.json({ user_id: 'other', credits_unlimited: true }),
  });
  useInvestigationCredits('current-user');
  assert.deepEqual(options.queryKey, ['investigationCredits', 'current-user']);
  await assert.rejects(options.queryFn({ signal: undefined }), /session changed/i);
  useInvestigationCredits(null);
  assert.equal(options.enabled, false);
});

test('current-session mismatch masks even a retained unlimited query result before another fetch', async () => {
  let sessionId = 'A'; let options; let fetches = 0;
  const { useInvestigationCredits } = await load('../src/hooks/useInvestigationCredits.js', {
    useSession: () => ({ data: { user: { id: sessionId } }, status: 'authenticated' }),
    useQuery: input => { options = input; return { data: { user_id: 'A', credits_unlimited: true } }; },
    fetch: async () => { fetches++; return Response.json({ user_id: 'A', credits_unlimited: true }); },
  });
  assert.equal(useInvestigationCredits('A').data.credits_unlimited, true);
  sessionId = 'B';
  assert.equal(useInvestigationCredits('A').data, undefined);
  assert.deepEqual(options.queryKey, ['investigationCredits', 'B']);
  assert.equal(options.enabled, false);
  await assert.rejects(options.queryFn({}), /session changed/i);
  assert.equal(fetches, 0);
});

test('pending or failed entitlement checks disable submission despite previously unlimited data', async () => {
  const empty = () => null;
  const { InvestigationForm } = await load('../src/components/NewInvestigation/InvestigationForm.jsx', {
    TargetTypeSelector: empty, TargetValueInput: empty, SearchOptions: empty, AdvancedOptions: empty,
    targetTypes: [{ value: 'domain', label: 'Domain' }],
  }, true);
  for (const state of [{ creditsPending: true }, { creditError: new Error('Synthetic failure') }]) {
    const html = renderToStaticMarkup(React.createElement(InvestigationForm, {
      targetType: 'domain', targetValue: 'example.invalid', user: { monthly_remaining: 0 },
      hasUnlimitedCredits: true, ...state,
    }));
    assert.match(html, /disabled=""/);
    assert.doesNotMatch(html, /Unlimited investigation credits/);
  }
});

test('zero-balance trial messaging does not falsely require an upgrade or promise a second trial', async () => {
  const { CreditsWarning } = await load('../src/components/NewInvestigation/CreditsWarning.jsx', {}, true);
  const html = renderToStaticMarkup(React.createElement(CreditsWarning, { monthlyRemaining: 0, isTrial: true }));
  assert.match(html, /allowance is checked when starting/);
  assert.doesNotMatch(html, /upgrade|unlimited|remaining/i);
});
