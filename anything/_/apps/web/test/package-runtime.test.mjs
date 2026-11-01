import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { packageRuntime } from '../scripts/package-runtime.mjs';

async function project(t, manifest) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'shadowtrace-runtime-test-'));
  // This test owns only the exact freshly-created directory.
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await fs.mkdir(path.join(directory, 'build', 'server'), { recursive: true });
  await fs.writeFile(path.join(directory, 'package.json'), JSON.stringify(manifest));
  return directory;
}
async function pkg(directory, name, manifest = {}, extra = {}) {
  const root = path.join(directory, 'node_modules', ...name.split('/'));
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ name, version: '1.0.0', main: 'index.cjs', ...manifest }));
  await fs.writeFile(path.join(root, 'index.cjs'), 'module.exports = ' + JSON.stringify(manifest.version ?? '1.0.0') + ';');
  for (const [name, value] of Object.entries(extra)) {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await fs.writeFile(path.join(root, name), value);
  }
  return root;
}

test('stages production closure with nested versions, peers, optional gaps and cycles', async t => {
  const directory = await project(t, { dependencies: { a: '*', shared: '*', peer: '*' }, devDependencies: { development: '*' } });
  const a = await pkg(directory, 'a', { dependencies: { b: '*', shared: '*' }, peerDependencies: { peer: '*' }, optionalDependencies: { absent: '*' } });
  await pkg(directory, 'shared', { version: '1.0.0' });
  await pkg(directory, 'peer', { version: '3.0.0' });
  await pkg(directory, 'development');
  await pkg(a, 'shared', { version: '2.0.0' });
  await pkg(directory, 'b', { dependencies: { a: '*' } }, { 'prebuilds/native.node': 'synthetic-native', 'tests/.env': 'synthetic-secret', '.env': 'synthetic-secret' });
  const report = await packageRuntime({ projectDir: directory });
  const output = path.join(directory, 'build', 'server', 'node_modules');
  const requireA = createRequire(path.join(output, 'a', 'index.cjs'));
  assert.equal(requireA('shared'), '2.0.0');
  assert.equal(requireA('peer'), '3.0.0');
  assert.equal(createRequire(path.join(output, 'root.cjs'))('shared'), '1.0.0');
  assert.equal(createRequire(path.join(output, 'b', 'index.cjs'))('a'), '1.0.0');
  assert.equal(report.packages, 5);
  assert.ok(report.omittedOptional.includes('a -> absent'));
  assert.equal(await fs.readFile(path.join(output, 'b', 'prebuilds', 'native.node'), 'utf8'), 'synthetic-native');
  await assert.rejects(fs.access(path.join(output, 'development')));
  await assert.rejects(fs.access(path.join(output, 'b', 'tests')));
  await assert.rejects(fs.access(path.join(output, 'b', '.env')));
  await assert.rejects(packageRuntime({ projectDir: directory }), /already exists/);
});

test('fails for missing required peers and enforces the size limit', async t => {
  const missing = await project(t, { dependencies: { a: '*' } });
  await pkg(missing, 'a', { peerDependencies: { required: '*' } });
  await assert.rejects(packageRuntime({ projectDir: missing }), /a -> required/);
  const tooLarge = await project(t, { dependencies: { a: '*' } });
  await pkg(tooLarge, 'a');
  await assert.rejects(packageRuntime({ projectDir: tooLarge, maxBytes: 1 }), /exceeds 1 bytes/);
  await assert.rejects(fs.access(path.join(tooLarge, 'build', 'server', 'node_modules', '.shadowtrace-runtime.json')));
});

test('copies installed optional dependencies and optional peers, excludes absent optional peers', async t => {
  const directory = await project(t, { dependencies: { a: '*' }, optionalDependencies: { absent: '*' } });
  await pkg(directory, 'a', { optionalDependencies: { optional: '*' }, peerDependencies: { presentPeer: '*', absentPeer: '*' }, peerDependenciesMeta: { presentPeer: { optional: true }, absentPeer: { optional: true } } });
  await pkg(directory, 'optional');
  await pkg(directory, 'presentPeer');
  const report = await packageRuntime({ projectDir: directory });
  assert.equal(report.packages, 3);
  assert.ok(report.omittedOptional.includes('absent'));
  assert.ok(report.omittedOptional.includes('a -> absentPeer'));
});

test('explicit runtime roots can omit unused declared build peers', async t => {
  const directory = await project(t, { dependencies: { a: '*', unused: '*' } });
  await pkg(directory, 'a', { dependencies: { '@scope/transitive': '*' }, peerDependencies: { buildTool: '*' } });
  await pkg(directory, '@scope/transitive');
  await pkg(directory, 'unused');
  const report = await packageRuntime({ projectDir: directory, roots: ['a'], includePeers: false });
  assert.equal(report.packages, 2);
  await assert.rejects(fs.access(path.join(directory, 'build', 'server', 'node_modules', 'unused')));
});

test('dereferences installed package links and refuses links escaping package content', async t => {
  const directory = await project(t, { dependencies: { linked: '*' } });
  const actual = await pkg(path.join(directory, 'store'), 'linked');
  await fs.mkdir(path.join(directory, 'node_modules'), { recursive: true });
  try {
    await fs.symlink(actual, path.join(directory, 'node_modules', 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (error.code !== 'EPERM') throw error;
    t.skip('This execution environment does not permit creating synthetic package links.');
    return;
  }
  await packageRuntime({ projectDir: directory });
  assert.equal((await fs.lstat(path.join(directory, 'build', 'server', 'node_modules', 'linked'))).isSymbolicLink(), false);

  const escaping = await project(t, { dependencies: { a: '*' } });
  const a = await pkg(escaping, 'a');
  const outside = path.join(escaping, 'private');
  await fs.mkdir(outside);
  await fs.writeFile(path.join(outside, 'secret.txt'), 'synthetic-private-value');
  await fs.symlink(outside, path.join(a, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(packageRuntime({ projectDir: escaping }), /symlink escapes/);
});
