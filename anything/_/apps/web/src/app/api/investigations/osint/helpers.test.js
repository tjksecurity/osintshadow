import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchDuckDuckGo, safeFetch } from "./helpers.js";

function makeFetchReturning(html) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => html,
  });
}

describe("searchDuckDuckGo", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts result links from classic result__a markup", async () => {
    const html = `
      <html><body>
        <a class="result__a" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fa">A</a>
        <a class="result__a" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fb">B</a>
      </body></html>
    `;

    global.fetch = makeFetchReturning(html);

    const links = await searchDuckDuckGo("test", { maxLinks: 10 });
    expect(links).toEqual(["https://example.com/a", "https://example.com/b"]);
  });

  it("falls back to uddg= link extraction when result__a markup is missing", async () => {
    const html = `
      <html><body>
        <div class="result">
          <a href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fc">C</a>
        </div>
        <div class="result">
          <a href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fd">D</a>
        </div>
      </body></html>
    `;

    global.fetch = makeFetchReturning(html);

    const links = await searchDuckDuckGo("test", { maxLinks: 10 });
    expect(links).toEqual(["https://example.com/c", "https://example.com/d"]);
  });

  it("returns [] when fetch fails", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network"));
    const links = await searchDuckDuckGo("test");
    expect(links).toEqual([]);
  });
});

describe("safeFetch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a 408 Response when fetch throws an AbortError", async () => {
    const abortErr = new Error("signal is aborted without reason");
    abortErr.name = "AbortError";

    global.fetch = vi.fn().mockRejectedValue(abortErr);

    const res = await safeFetch("https://example.com", {
      timeoutMs: 5,
      retries: 0,
    });
    expect(res).toBeTruthy();
    expect(res.ok).toBe(false);
    expect(res.status).toBe(408);
  });
});
