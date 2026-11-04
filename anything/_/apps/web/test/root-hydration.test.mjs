import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

// Execute the actual root Layout and actual font-plugin-generated component,
// while isolating unrelated router/auth/editor hooks. No application modules,
// network transport, DOM, credentials or database connections are imported.
// This checks initial markup parity; it does not simulate browser hydration.
function compile(source, bindings) {
  const isolated = source
    .replace(/^import\s+['"][^'"]+['"];?\s*/gm, '')
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm, '');
  const compiled = ts.transpileModule(isolated, {
    fileName: 'root-hydration-fixture.tsx',
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const errors = compiled.diagnostics.filter(item => item.category === ts.DiagnosticCategory.Error);
  assert.deepEqual(errors.map(item => ts.flattenDiagnosticMessageText(item.messageText, ' ')), []);
  const exports = {};
  new Function('exports', ...Object.keys(bindings), compiled.outputText)(exports, ...Object.values(bindings));
  return exports;
}

const pluginSource = await readFile(new URL('../plugins/loadFontsFromTailwindSource.ts', import.meta.url), 'utf8');
const declaredFontSource = await readFile(new URL('../src/app/investigations/new/page.jsx', import.meta.url), 'utf8');
const rootSource = await readFile(new URL('../src/app/root.tsx', import.meta.url), 'utf8');
const { loadFontsFromTailwindSource } = compile(pluginSource, {});
const plugins = loadFontsFromTailwindSource();
plugins[0].transform(declaredFontSource, 'src/app/investigations/new/page.jsx');
const virtualSource = plugins[1].load('virtual:load-fonts.jsx');
const { LoadFonts } = compile(virtualSource, { React });

const noop = () => {};
const bindings = {
  React,
  Component: React.Component,
  useCallback: callback => callback,
  useEffect: noop,
  useRef: () => ({ current: null }),
  useState: initial => [typeof initial === 'function' ? initial() : initial, noop],
  useLocation: () => ({ pathname: '/' }),
  useNavigate: () => noop,
  useSandboxStore: () => ({
    startCodeGen: noop,
    setCodeGenGenerating: noop,
    completeCodeGen: noop,
    errorCodeGen: noop,
    stopCodeGen: noop,
  }),
  useDevServerHeartbeat: noop,
  LoadFonts,
  Meta: () => null,
  Links: () => null,
  HotReloadIndicator: () => null,
  Toaster: () => null,
  ScrollRestoration: () => null,
  Scripts: () => null,
};

function renderInitialHead(ssr) {
  const source = rootSource
    .replaceAll('import.meta.env.SSR', String(ssr))
    .replaceAll('import.meta.hot', 'undefined');
  const { Layout } = compile(source, bindings);
  const html = renderToStaticMarkup(React.createElement(Layout, {
    children: React.createElement('p', null, 'Synthetic route content'),
  }));
  const match = html.match(/<head>([\s\S]*?)<\/head>/);
  assert.ok(match, 'actual root Layout must retain its document head');
  return match[1];
}

test('actual font plugin generates the declared Inter stylesheet', () => {
  const markup = renderToStaticMarkup(React.createElement(LoadFonts));
  assert.match(markup, /<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?family=Inter:/);
  assert.equal((markup.match(/<link /g) || []).length, 1);
});

test('actual root retains the same font stylesheet head on server and initial client render', () => {
  const serverHead = renderInitialHead(true);
  const initialClientHead = renderInitialHead(false);
  assert.match(serverHead, /fonts\.googleapis\.com\/css2\?family=Inter:/, 'server must keep the font stylesheet');
  assert.equal(initialClientHead, serverHead, 'initial client head must retain the server font markup, not remove or suppress it');
});
