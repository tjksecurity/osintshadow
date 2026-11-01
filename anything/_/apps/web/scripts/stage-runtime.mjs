import { parseSync } from '@babel/core';
import { readdirSync, readFileSync } from 'node:fs';
import { isBuiltin } from 'node:module';
import { join, resolve } from 'node:path';
import { packageRuntime } from './package-runtime.mjs';

const projectRoot = process.cwd();
const buildRoot = resolve(projectRoot, 'build/server');
const packages = new Set();
function addSpecifier(specifier) {
  if (!specifier || specifier.startsWith('.') || specifier.startsWith('/') || isBuiltin(specifier)) return;
  const parts = specifier.split('/');
  packages.add(specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]);
}
function visit(node) {
  if (!node || typeof node !== 'object') return;
  if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type)) {
    addSpecifier(node.source?.value);
  }
  if (node.type === 'ImportExpression') addSpecifier(node.source?.value);
  if (node.type === 'CallExpression' && (node.callee?.type === 'Import' || node.callee?.name === 'require')) {
    addSpecifier(node.arguments?.[0]?.value);
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') visit(value);
  }
}
function scan(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const file = join(directory, entry.name);
    if (entry.isDirectory()) scan(file);
    else if (/\.(?:mjs|cjs|js)$/.test(entry.name)) {
      visit(parseSync(readFileSync(file, 'utf8'), { filename: file, sourceType: 'unambiguous', babelrc: false, configFile: false }));
    }
  }
}
scan(buildRoot);
const result = await packageRuntime({ projectDir: projectRoot, buildDir: buildRoot, roots: [...packages].sort() });
console.log(`Staged ${result.packages} runtime packages (${(result.bytes / 1024 / 1024).toFixed(1)} MiB).`);
