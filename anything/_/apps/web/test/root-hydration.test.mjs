import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { prepareDocumentHydration } from '../src/__create/prepare-document-hydration.js';

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

// Minimal DOM/observer fixture: checks ownership, identity and lifecycle, not
// React's DOM hydration implementation. The deployed browser check is separate.
function documentFixture() {
  const observers = [];
  const events = new Map();
  function element(tagName, id = '') {
    return {
      tagName, id, children: [], parentElement: null,
      appendChild(node) {
        if (node.parentElement) {
          const siblings = node.parentElement.children;
          siblings.splice(siblings.indexOf(node), 1);
        }
        this.children.push(node);
        node.parentElement = this;
        return node;
      },
    };
  }
  const documentElement = element('HTML');
  const head = documentElement.appendChild(element('HEAD'));
  const body = documentElement.appendChild(element('BODY'));
  class MutationObserver {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(target, options) { this.target = target; this.options = options; this.active = true; }
    disconnect() { this.active = false; }
  }
  const flush = () => observers.filter(item => item.active).forEach(item => item.callback([]));
  const defaultView = {
    MutationObserver,
    addEventListener: (name, listener) => events.set(name, listener),
    removeEventListener: (name, listener) => { if (events.get(name) === listener) events.delete(name); },
  };
  return { document: { documentElement, head, body, defaultView }, element, observers, flush, events };
}

const commentsRootId = 'codex-browser-sidebar-comments-root';

test('misplaced browser comments root keeps its identity and state inside body before hydration', () => {
  const { document, element } = documentFixture();
  const widget = document.documentElement.appendChild(element('DIV', commentsRootId));
  const child = widget.appendChild(element('SPAN', 'synthetic-comment'));
  const state = { shadowRoot: {}, listener: () => {} };
  Object.assign(widget, state);
  const stop = prepareDocumentHydration(document);
  assert.equal(widget.parentElement, document.body);
  assert.equal(document.body.children.at(-1), widget);
  assert.equal(widget.shadowRoot, state.shadowRoot);
  assert.equal(widget.listener, state.listener);
  assert.equal(widget.id, commentsRootId);
  assert.deepEqual(widget.children, [child]);
  assert.equal(child.parentElement, widget);
  assert.deepEqual(document.documentElement.children, [document.head, document.body]);
  stop();
});

test('comments root arriving during concurrent hydration is preserved, with observation bounded to hydration', () => {
  const { document, element, observers, flush } = documentFixture();
  const stop = prepareDocumentHydration(document);
  assert.equal(observers.length, 1);
  assert.equal(observers[0].target, document.documentElement);
  assert.deepEqual(observers[0].options, { childList: true });
  const widget = document.documentElement.appendChild(element('DIV', commentsRootId));
  flush();
  assert.equal(widget.parentElement, document.body);
  flush();
  assert.deepEqual(document.body.children, [widget]);
  stop();
  stop();
  document.documentElement.appendChild(widget);
  flush();
  assert.equal(widget.parentElement, document.documentElement, 'stop must disconnect permanently');
});

test('does not move ordinary root nodes, nested widgets, head, body, or a different tag with the same ID', () => {
  const { document, element, flush } = documentFixture();
  const unrelated = document.documentElement.appendChild(element('DIV', 'other-extension'));
  const wrongTag = document.documentElement.appendChild(element('SCRIPT', commentsRootId));
  const container = document.body.appendChild(element('MAIN'));
  const nested = container.appendChild(element('DIV', commentsRootId));
  const stop = prepareDocumentHydration(document);
  flush();
  assert.deepEqual(document.documentElement.children, [document.head, document.body, unrelated, wrongTag]);
  assert.equal(nested.parentElement, container);
  stop();
});

test('normal documents are unchanged and missing document is a safe no-op', () => {
  const { document } = documentFixture();
  const stop = prepareDocumentHydration(document);
  assert.deepEqual(document.documentElement.children, [document.head, document.body]);
  assert.deepEqual(document.body.children, []);
  stop();
  assert.doesNotThrow(() => prepareDocumentHydration(undefined)());
});

test('page exit disconnects the temporary observer', () => {
  const { document, observers, events } = documentFixture();
  prepareDocumentHydration(document);
  assert.equal(observers[0].active, true);
  events.get('pagehide')();
  assert.equal(observers[0].active, false);
  assert.equal(events.size, 0);
});

test('never fights a host that reparents its own widget back outside body', () => {
  const { document, element, observers, flush } = documentFixture();
  const stop = prepareDocumentHydration(document);
  const widget = document.documentElement.appendChild(element('DIV', commentsRootId));
  flush();
  assert.equal(widget.parentElement, document.body);
  // A browser-owned UI may enforce its own placement. Never form a mutation
  // observer ping-pong loop with that host, even before React has committed.
  document.documentElement.appendChild(widget);
  flush();
  assert.equal(widget.parentElement, document.documentElement);
  assert.equal(observers[0].active, false);
  stop();
});

test('actual client entry prepares before hydration, ends on commit, and retains default router structure', async () => {
  const source = await readFile(new URL('../src/app/entry.client.tsx', import.meta.url), 'utf8');
  const steps = [];
  const effects = [];
  const document = {};
  const HydratedRouter = () => null;
  compile(source, {
    React, document, StrictMode: React.StrictMode, HydratedRouter,
    startTransition: callback => { steps.push('transition'); callback(); },
    useEffect: (callback, dependencies) => { assert.deepEqual(dependencies, []); effects.push(callback); },
    prepareDocumentHydration: actual => {
      assert.equal(actual, document);
      steps.push('prepare');
      return () => steps.push('finish');
    },
    hydrateRoot: (actual, tree) => {
      assert.equal(actual, document);
      steps.push('hydrate');
      assert.equal(tree.type, React.StrictMode);
      const content = tree.props.children.type();
      assert.equal(content.type, HydratedRouter);
    },
  });
  assert.deepEqual(steps, ['prepare', 'transition', 'hydrate']);
  effects[0]();
  assert.deepEqual(steps, ['prepare', 'transition', 'hydrate', 'finish']);
});

test('actual client entry cleans up and rethrows a synchronous hydration failure', async () => {
  const source = await readFile(new URL('../src/app/entry.client.tsx', import.meta.url), 'utf8');
  const failure = new Error('synthetic hydration failure');
  let finished = false;
  assert.throws(() => compile(source, {
    React, document: {}, StrictMode: React.StrictMode,
    startTransition: callback => callback(),
    useEffect: () => {},
    prepareDocumentHydration: () => () => { finished = true; },
    hydrateRoot: () => { throw failure; },
  }), error => error === failure);
  assert.equal(finished, true);
});

test('single-child hydration wrapper preserves React useId tree positions', async () => {
  const source = await readFile(new URL('../src/app/entry.client.tsx', import.meta.url), 'utf8');
  const Child = () => React.createElement('span', { id: React.useId() });
  const HydratedRouter = () => React.createElement('main', { id: React.useId() },
    React.createElement(Child), React.createElement(Child));
  let actual;
  compile(source, {
    React, document: {}, StrictMode: React.StrictMode, HydratedRouter,
    startTransition: callback => callback(),
    useEffect: () => {},
    prepareDocumentHydration: () => () => {},
    hydrateRoot: (_, tree) => { actual = renderToStaticMarkup(tree); },
  });
  const original = renderToStaticMarkup(React.createElement(React.StrictMode, null,
    React.createElement(HydratedRouter)));
  assert.equal(actual, original);
});
