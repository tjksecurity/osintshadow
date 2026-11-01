import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const DEFAULT_LIMIT = 200 * 1024 * 1024;
const omittedDirectories = new Set(['node_modules', '.git', '.svn', '.hg', 'test', 'tests', '__tests__', 'fixtures', '__fixtures__']);
const validName = /^(?:@[a-zA-Z0-9_.-]+\/)?[a-zA-Z0-9_.-]+$/;
const inside = (root, candidate) => {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
};

// Stage the installed production graph, not the complete development install.
// A fresh React Router build is required: existing runtime output is never deleted.
export async function packageRuntime({ projectDir = path.resolve(import.meta.dirname, '..'), buildDir, maxBytes = DEFAULT_LIMIT, roots, includePeers = true } = {}) {
  projectDir = await fs.realpath(projectDir);
  buildDir = await fs.realpath(buildDir ?? path.join(projectDir, 'build', 'server'));
  if (!inside(projectDir, buildDir) || buildDir === projectDir) throw new Error('Runtime build directory must be inside the project.');
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error('maxBytes must be a positive safe integer.');
  const output = path.join(buildDir, 'node_modules');
  try { await fs.lstat(output); throw new Error('Runtime node_modules already exists; run a fresh build before packaging.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }

  const project = JSON.parse(await fs.readFile(path.join(projectDir, 'package.json'), 'utf8'));
  const dependencies = { ...project.dependencies, ...project.optionalDependencies };
  const rootNames = roots ?? Object.keys(dependencies);
  if (!Array.isArray(rootNames)) throw new Error('roots must be an array of installed package names.');
  const staging = output;
  await fs.mkdir(staging);
  const placements = new Map();
  const queue = [];
  const report = { packages: 0, files: 0, bytes: 0, maxBytes, omittedOptional: [], entries: [] };

  function nameParts(name) {
    if (typeof name !== 'string' || !validName.test(name) || name.split('/').some(part => part === '.' || part === '..')) throw new Error('Invalid dependency name: ' + name);
    return name.split('/');
  }
  async function resolvePackage(name, from) {
    const parts = nameParts(name);
    const search = createRequire(path.join(from, 'package.json')).resolve.paths(name) ?? [];
    for (const directory of search) {
      // Do not accidentally package packages installed globally on the build host.
      if (!inside(projectDir, directory)) continue;
      const candidate = path.join(directory, ...parts);
      try {
        const real = await fs.realpath(candidate);
        const manifest = JSON.parse(await fs.readFile(path.join(real, 'package.json'), 'utf8'));
        return { real, manifest };
      } catch (error) { if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error; }
    }
    return null;
  }
  function place(name, source, destination) {
    const existing = placements.get(destination);
    if (existing) {
      if (existing.real !== source.real) throw new Error('Conflicting runtime package placement: ' + name);
      return existing;
    }
    const item = { name, ...source, destination };
    placements.set(destination, item);
    queue.push(item);
    return item;
  }
  function visiblePackage(name, from) {
    const search = createRequire(path.join(from, 'package.json')).resolve.paths(name) ?? [];
    for (const directory of search) {
      const item = placements.get(path.join(directory, ...nameParts(name)));
      if (item) return item;
    }
    return null;
  }
  async function copyPackage(source, destination, packageRoot, ancestors = new Set()) {
    const real = await fs.realpath(source);
    if (!inside(packageRoot, real)) throw new Error('Package symlink escapes its package: ' + source);
    const stat = await fs.stat(real);
    if (stat.isDirectory()) {
      if (ancestors.has(real)) throw new Error('Cyclic directory symlink in package: ' + source);
      const next = new Set(ancestors).add(real);
      await fs.mkdir(destination, { recursive: true });
      for (const entry of (await fs.readdir(real, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
        if (omittedDirectories.has(entry.name) || entry.name === '.npmrc' || /^\.env(?:\.|$)/.test(entry.name)) continue;
        await copyPackage(path.join(real, entry.name), path.join(destination, entry.name), packageRoot, next);
      }
    } else if (stat.isFile()) {
      if (report.bytes + stat.size > maxBytes) throw new Error(`Production runtime exceeds ${maxBytes} bytes; packaging stopped before deployment.`);
      await fs.copyFile(real, destination);
      await fs.chmod(destination, stat.mode & 0o777);
      report.bytes += stat.size;
      report.files++;
    } else throw new Error('Unsupported package filesystem entry: ' + source);
  }

  // Register every root before traversing, keeping explicit versions authoritative.
  for (const name of [...new Set(rootNames)].sort()) {
    const source = await resolvePackage(name, projectDir);
    if (!source) {
      if (Object.hasOwn(project.optionalDependencies ?? {}, name)) { report.omittedOptional.push(name); continue; }
      throw new Error('Required production dependency is not installed: ' + name);
    }
    place(name, source, path.join(staging, ...nameParts(name)));
  }

  for (let index = 0; index < queue.length; index++) {
    const item = queue[index];
    await copyPackage(item.real, item.destination, item.real);
    report.packages++;
    report.entries.push({ name: item.name, version: item.manifest.version ?? null, path: path.relative(staging, item.destination).split(path.sep).join('/') });
    const edges = new Map();
    for (const name of Object.keys(item.manifest.dependencies ?? {})) edges.set(name, false);
    for (const name of includePeers ? Object.keys(item.manifest.peerDependencies ?? {}) : []) {
      if (!edges.has(name)) edges.set(name, item.manifest.peerDependenciesMeta?.[name]?.optional === true);
    }
    for (const name of Object.keys(item.manifest.optionalDependencies ?? {})) edges.set(name, true);
    for (const [name, optional] of [...edges].sort(([a], [b]) => a.localeCompare(b))) {
      const source = await resolvePackage(name, item.real);
      if (!source) {
        if (optional) { report.omittedOptional.push(item.name + ' -> ' + name); continue; }
        throw new Error('Required production dependency is not installed: ' + item.name + ' -> ' + name);
      }
      if (visiblePackage(name, item.destination)?.real === source.real) continue;
      const rootDestination = path.join(staging, ...nameParts(name));
      // Share a root installation when available; collisions retain nested versions.
      const destination = !placements.has(rootDestination) && !visiblePackage(name, item.destination)
        ? rootDestination : path.join(item.destination, 'node_modules', ...nameParts(name));
      place(name, source, destination);
    }
  }
  await fs.writeFile(path.join(staging, '.shadowtrace-runtime.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  const report = await packageRuntime();
  console.log(`Packaged ${report.packages} production packages (${report.files} files, ${(report.bytes / 1024 / 1024).toFixed(1)} MiB; limit ${(report.maxBytes / 1024 / 1024).toFixed(0)} MiB).`);
}
