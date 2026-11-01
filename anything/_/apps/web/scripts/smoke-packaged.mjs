import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Only deployable files enter this isolated directory. Dependencies cannot
// accidentally resolve from the checkout's development node_modules tree.
const directory = mkdtempSync(join(tmpdir(), 'shadowtrace-runtime-'));
try {
  mkdirSync(join(directory, 'build'), { recursive: true });
  mkdirSync(join(directory, 'scripts'));
  cpSync('build/server', join(directory, 'build/server'), { recursive: true });
  cpSync('api', join(directory, 'api'), { recursive: true });
  cpSync('scripts/smoke-fetch.mjs', join(directory, 'scripts/smoke-fetch.mjs'));
  writeFileSync(join(directory, 'package.json'), JSON.stringify({ type: 'module' }));
  for (const configuredAuth of ['0', '1']) {
    const result = spawnSync(process.execPath, ['scripts/smoke-fetch.mjs'], {
      cwd: directory,
      env: { ...process.env, NODE_PATH: '', SHADOWTRACE_SMOKE_WITH_AUTH: configuredAuth },
      encoding: 'utf8',
      timeout: 30000,
    });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    process.stdout.write(result.stdout);
  }
} finally {
  // This exact directory was created above and contains only smoke artifacts.
  rmSync(directory, { recursive: true, force: true });
}
