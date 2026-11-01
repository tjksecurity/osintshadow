import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("investigation creation does not log raw request data or mint log-backed session tokens", async () => {
  const route = await readFile(
    new URL("../src/app/api/investigations/route.js", import.meta.url),
    "utf8",
  );
  const database = await readFile(
    new URL("../src/app/api/investigations/utils/database.js", import.meta.url),
    "utf8",
  );
  const sessionLookup = await readFile(
    new URL("../src/app/api/investigations/session/route.js", import.meta.url),
    "utf8",
  );
  for (const disclosure of [
    "Request headers:",
    "Raw request body:",
    "Request body parsed successfully:",
    "investigation_session_token",
    "Generated session token:",
    "target_value,\n          flags: processingFlags",
  ]) {
    assert.doesNotMatch(route, new RegExp(disclosure.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(database, /console\.log\("Creating investigation:/);
  assert.doesNotMatch(sessionLookup, /Looking up session token:|Session token not found or expired:/);
});

test("unsupported social monitoring sources are not described as mocked or live data", async () => {
  const monitoring = await readFile(
    new URL("../src/app/api/social-monitoring/tick/route.js", import.meta.url),
    "utf8",
  );
  const collectors = await readFile(
    new URL("../src/app/api/investigations/osint/social/postCollectors.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(monitoring, /mocked for most platforms/i);
  assert.match(monitoring, /Unsupported/);
  assert.match(monitoring, /platforms return no posts/);
  assert.match(collectors, /do not generate synthetic\/mock social posts/);
});
