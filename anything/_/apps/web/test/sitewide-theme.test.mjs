import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { safeReportUrl } from '../src/utils/reportSafety.js';

// Actual presentation modules, isolated from auth, routing, maps and network.
// These fixtures verify markup/controls, not browser layout or live acceptance.
const read = file => readFile(new URL(file, import.meta.url), 'utf8');
const forbidden = () => { throw new Error('Live operation forbidden in visual fixtures'); };
async function load(file, bindings = {}) {
  let source = await read(file);
  const names = [...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']lucide-react["']/g)]
    .flatMap(match => match[1].split(',').map(name => name.trim()).filter(Boolean));
  const icons = Object.fromEntries(names.map(name => [name, () => React.createElement('svg', {'aria-hidden':true})]));
  source = source.replace(/^import\s+["'][^"']+["'];?\s*/gm, '')
    .replace(/^import[\s\S]*?from\s+["'][^"']+["'];?\s*/gm, '');
  const compiled = ts.transpileModule(source, {fileName:file, reportDiagnostics:true, compilerOptions:{jsx:ts.JsxEmit.React, module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022}});
  assert.deepEqual(compiled.diagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error).map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')), [], file);
  const scope = {React, useState:React.useState, useMemo:React.useMemo, useEffect:React.useEffect, useCallback:React.useCallback, ...icons, ...bindings};
  const exports = {};
  new Function('exports', ...Object.keys(scope), compiled.outputText)(exports, ...Object.values(scope));
  return exports;
}
const {default:BrandLogo} = await load('../src/components/BrandLogo.jsx');
const {default:AccountLayout} = await load('../src/components/Theme/AccountLayout.jsx',{BrandLogo});
const useAuth = () => ({signInWithCredentials:forbidden, signUpWithCredentials:forbidden, signOut:forbidden});
const render = (Component, props={}) => renderToStaticMarkup(React.createElement(Component,props));
const accountRoutes = [['signin',2],['signup',3],['password/forgot',1],['password/reset',4],['logout',0]];

for (const [route, inputCount] of accountRoutes) {
  test(`${route}: shared homepage identity, semantic landmarks and labelled controls`, async () => {
    const {default:Page} = await load(`../src/app/account/${route}/page.jsx`,{AccountLayout,useAuth,fetch:forbidden});
    const html=render(Page);
    assert.match(html,/st-product st-account-page/);
    assert.match(html,/aria-label="ShadowTrace"/);
    assert.match(html,/viewBox="0 0 176 32"/);
    assert.equal((html.match(/<h1\b/g)||[]).length,1);
    for(const tag of ['header','main','footer'])assert.match(html,new RegExp(`<${tag}\\b`));
    assert.match(html,/aria-labelledby="st-account-title"/);
    assert.match(html,/<h1 id="st-account-title">/);
    const inputs=[...html.matchAll(/<input\b[^>]*>/g)].map(m=>m[0]).filter(input=>!input.includes('type="hidden"'));
    assert.equal(inputs.length,inputCount);
    const ids=inputs.map(input=>input.match(/id="([^"]+)"/)?.[1]);
    assert.equal(new Set(ids).size,inputCount);
    inputs.forEach((input,i)=>{assert.ok(ids[i]);assert.ok(html.includes(`for="${ids[i]}"`));assert.match(input,/required=""/);});
    assert.equal((html.match(/<form\b/g)||[]).length,inputCount?1:0);
    if(route==='signin')assert.match(html,/<input type="hidden" name="callbackUrl" value="\/dashboard"/);
    if(['signin','signup','password/reset'].includes(route)) {
      assert.match(html,/<button type="button" aria-label="Show password" aria-pressed="false"/);
      assert.equal((html.match(/type="password"/g)||[]).length,route==='signin'?1:2);
    }
  });
}

function elements(node) {
  if(Array.isArray(node))return node.flatMap(elements);
  if(!React.isValidElement(node))return [];
  return [node,...elements(node.props.children)];
}
for(const route of ['signin','signup','password/reset']) {
  test(`${route}: password reveal control toggles without invoking submission`, async()=>{
    const state=[];let cursor=0;
    const useState=initial=>{const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],value=>{state[i]=typeof value==='function'?value(state[i]):value;}];};
    const {default:Page}=await load(`../src/app/account/${route}/page.jsx`,{AccountLayout,useAuth,useState,useEffect:()=>{},useMemo:fn=>fn(),fetch:forbidden});
    const tree=()=>{cursor=0;return elements(Page());};
    let nodes=tree();let reveal=nodes.find(node=>node.props['aria-label']==='Show password');
    assert.equal(reveal.props.type,'button');
    assert.ok(nodes.some(node=>node.type==='input'&&node.props.type==='password'));
    reveal.props.onClick();nodes=tree();
    reveal=nodes.find(node=>node.props['aria-label']==='Hide password');
    assert.equal(reveal.props['aria-pressed'],true);
    assert.equal(nodes.filter(node=>node.type==='input'&&node.props.type==='password').length,0);
    reveal.props.onClick();assert.ok(tree().some(node=>node.props['aria-label']==='Show password'));
  });
}

test('workspace routes and investigation components no longer carry the legacy palette',async()=>{
  const routes=['administration','ai/chat','billing','debug','investigations','investigations/new','investigations/[id]','map','settings'];
  for(const route of routes) {
    const source=await read(`../src/app/${route}/page.jsx`);
    assert.match(source,/st-workspace/,route);
    assert.doesNotMatch(source,/#(?:263043|232D41|2D384E|37425B|303B52|00D1FF|00B8E6)/i,route);
  }
  for(const directory of ['NewInvestigation','InvestigationDetail']) {
    const files=await readdir(new URL(`../src/components/${directory}/`,import.meta.url));
    for(const file of files.filter(file=>file.endsWith('.jsx'))) {
      const source=await read(`../src/components/${directory}/${file}`);
      assert.doesNotMatch(source,/#(?:263043|232D41|2D384E|37425B|303B52|00D1FF|00B8E6)/i,file);
      const parsed=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);
      assert.equal(parsed.parseDiagnostics.length,0,file);
    }
  }
});

test('shared tokens match homepage; keyboard focus, mobile layout and reduced motion are explicit',async()=>{
  const css=await read('../src/components/Theme/product.css');
  const home=await read('../src/components/Landing/shadowtrace.css');
  for(const token of ['bg','panel','line','muted','accent','ink']) {
    const pattern=new RegExp(`--st-${token}:\\s*(#[0-9a-f]+)`,'i');
    assert.equal(css.match(pattern)?.[1],home.match(pattern)?.[1],token);
  }
  assert.match(css,/:is\(a, button, input, textarea, select, summary\):focus-visible\s*\{[^}]*outline:[^;]+!important/);
  assert.match(css,/@media \(max-width: 767px\)[\s\S]*grid-template-columns: 1fr/);
  assert.match(css,/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none/);
  assert.doesNotMatch(css,/overflow:\s*clip/);
});

test('report viewer retains a white document canvas, sandbox and entitlement behavior',async()=>{
  const {ReportTab}=await load('../src/components/InvestigationDetail/ReportTab.jsx',{safeReportUrl});
  const investigation={html_content:'<h1>Synthetic report</h1>',pdf_url:'/api/reports/example.pdf'};
  const html=render(ReportTab,{investigation,user:{subscription_plan:'professional'}});
  assert.match(html,/<iframe[^>]*bg-white/);
  assert.match(html,/sandbox="allow-popups allow-popups-to-escape-sandbox"/);
  assert.match(html,/referrerPolicy="no-referrer"/);
  assert.match(html,/srcDoc="&lt;h1&gt;Synthetic report&lt;\/h1&gt;"/);
  assert.match(html,/Download PDF/);
  assert.doesNotMatch(render(ReportTab,{investigation,user:{subscription_plan:'trial'}}),/Download PDF/);
  assert.match(render(ReportTab,{investigation:{},user:{}}),/Report not generated yet/);
  assert.doesNotMatch(render(ReportTab,{investigation:{...investigation,pdf_url:'javascript:alert(1)'},user:{subscription_plan:'professional'}}),/Download PDF/);
});

test('not-found screen shares branding without forcing a desktop minimum width',async()=>{
  const {default:Page}=await load('../src/app/__create/not-found.tsx',{BrandLogo,useNavigate:()=>forbidden,fg:forbidden});
  const html=render(Page,{loaderData:{path:'/synthetic-missing-route',pages:[]}});
  assert.match(html,/st-product st-workspace/);
  assert.match(html,/aria-label="ShadowTrace"/);
  assert.doesNotMatch(html,/min-w-\[850px\]/);
});
