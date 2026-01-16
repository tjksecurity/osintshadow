// Lightweight crypto helpers that avoid importing Node builtins like `node:crypto`.
//
// Why: The Anything production runtime used for published sites does not reliably
// support `node:`-prefixed built-in modules (e.g. `node:crypto`). Some parts of
// the app only needed hashing/HMAC. This file provides those pieces using the
// Web Crypto API when available, with small JS fallbacks where needed.

function hasSubtle() {
  return (
    typeof globalThis !== "undefined" &&
    globalThis.crypto &&
    globalThis.crypto.subtle &&
    typeof globalThis.crypto.subtle.digest === "function"
  );
}

function getEncoder() {
  if (typeof TextEncoder === "undefined") {
    return null;
  }
  return new TextEncoder();
}

function bytesToHex(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

function hexToBytes(hex) {
  if (typeof hex !== "string") return new Uint8Array();
  const clean = hex.trim().toLowerCase();
  if (clean.length % 2 !== 0) return new Uint8Array();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function timingSafeEqualHex(aHex, bHex) {
  const a = hexToBytes(aHex);
  const b = hexToBytes(bHex);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

function normalizeToBytes(input) {
  if (input == null) return new Uint8Array();
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);

  // Node Buffer (safe check without importing Buffer type)
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(input)) {
    return new Uint8Array(input);
  }

  const enc = getEncoder();
  if (!enc) {
    // Best-effort for very old runtimes: treat as latin1
    const s = String(input);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i += 1) out[i] = s.charCodeAt(i) & 0xff;
    return out;
  }
  return enc.encode(String(input));
}

export async function digestHex(algorithm, data) {
  if (!hasSubtle()) {
    throw new Error("WebCrypto subtle.digest is not available");
  }

  const bytes = normalizeToBytes(data);
  const hash = await globalThis.crypto.subtle.digest(algorithm, bytes);
  return bytesToHex(new Uint8Array(hash));
}

export async function hmacSha256Hex(secret, data) {
  if (!hasSubtle()) {
    throw new Error("WebCrypto subtle is not available");
  }

  const keyBytes = normalizeToBytes(secret);
  const dataBytes = normalizeToBytes(data);

  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: { name: "SHA-256" } },
    false,
    ["sign"],
  );

  const sig = await globalThis.crypto.subtle.sign("HMAC", key, dataBytes);
  return bytesToHex(new Uint8Array(sig));
}

// Minimal MD5 implementation (string input) used for Gravatar.
// Public domain style implementation adapted for this project.
export function md5Hex(input) {
  const str = String(input);

  function cmn(q, a, b, x, s, t) {
    a = add32(add32(a, q), add32(x, t));
    return add32((a << s) | (a >>> (32 - s)), b);
  }

  function ff(a, b, c, d, x, s, t) {
    return cmn((b & c) | (~b & d), a, b, x, s, t);
  }

  function gg(a, b, c, d, x, s, t) {
    return cmn((b & d) | (c & ~d), a, b, x, s, t);
  }

  function hh(a, b, c, d, x, s, t) {
    return cmn(b ^ c ^ d, a, b, x, s, t);
  }

  function ii(a, b, c, d, x, s, t) {
    return cmn(c ^ (b | ~d), a, b, x, s, t);
  }

  function md5cycle(x, k) {
    let [a, b, c, d] = x;

    a = ff(a, b, c, d, k[0], 7, -680876936);
    d = ff(d, a, b, c, k[1], 12, -389564586);
    c = ff(c, d, a, b, k[2], 17, 606105819);
    b = ff(b, c, d, a, k[3], 22, -1044525330);
    a = ff(a, b, c, d, k[4], 7, -176418897);
    d = ff(d, a, b, c, k[5], 12, 1200080426);
    c = ff(c, d, a, b, k[6], 17, -1473231341);
    b = ff(b, c, d, a, k[7], 22, -45705983);
    a = ff(a, b, c, d, k[8], 7, 1770035416);
    d = ff(d, a, b, c, k[9], 12, -1958414417);
    c = ff(c, d, a, b, k[10], 17, -42063);
    b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7, 1804603682);
    d = ff(d, a, b, c, k[13], 12, -40341101);
    c = ff(c, d, a, b, k[14], 17, -1502002290);
    b = ff(b, c, d, a, k[15], 22, 1236535329);

    a = gg(a, b, c, d, k[1], 5, -165796510);
    d = gg(d, a, b, c, k[6], 9, -1069501632);
    c = gg(c, d, a, b, k[11], 14, 643717713);
    b = gg(b, c, d, a, k[0], 20, -373897302);
    a = gg(a, b, c, d, k[5], 5, -701558691);
    d = gg(d, a, b, c, k[10], 9, 38016083);
    c = gg(c, d, a, b, k[15], 14, -660478335);
    b = gg(b, c, d, a, k[4], 20, -405537848);
    a = gg(a, b, c, d, k[9], 5, 568446438);
    d = gg(d, a, b, c, k[14], 9, -1019803690);
    c = gg(c, d, a, b, k[3], 14, -187363961);
    b = gg(b, c, d, a, k[8], 20, 1163531501);
    a = gg(a, b, c, d, k[13], 5, -1444681467);
    d = gg(d, a, b, c, k[2], 9, -51403784);
    c = gg(c, d, a, b, k[7], 14, 1735328473);
    b = gg(b, c, d, a, k[12], 20, -1926607734);

    a = hh(a, b, c, d, k[5], 4, -378558);
    d = hh(d, a, b, c, k[8], 11, -2022574463);
    c = hh(c, d, a, b, k[11], 16, 1839030562);
    b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1], 4, -1530992060);
    d = hh(d, a, b, c, k[4], 11, 1272893353);
    c = hh(c, d, a, b, k[7], 16, -155497632);
    b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4, 681279174);
    d = hh(d, a, b, c, k[0], 11, -358537222);
    c = hh(c, d, a, b, k[3], 16, -722521979);
    b = hh(b, c, d, a, k[6], 23, 76029189);
    a = hh(a, b, c, d, k[9], 4, -640364487);
    d = hh(d, a, b, c, k[12], 11, -421815835);
    c = hh(c, d, a, b, k[15], 16, 530742520);
    b = hh(b, c, d, a, k[2], 23, -995338651);

    a = ii(a, b, c, d, k[0], 6, -198630844);
    d = ii(d, a, b, c, k[7], 10, 1126891415);
    c = ii(c, d, a, b, k[14], 15, -1416354905);
    b = ii(b, c, d, a, k[5], 21, -57434055);
    a = ii(a, b, c, d, k[12], 6, 1700485571);
    d = ii(d, a, b, c, k[3], 10, -1894986606);
    c = ii(c, d, a, b, k[10], 15, -1051523);
    b = ii(b, c, d, a, k[1], 21, -2054922799);
    a = ii(a, b, c, d, k[8], 6, 1873313359);
    d = ii(d, a, b, c, k[15], 10, -30611744);
    c = ii(c, d, a, b, k[6], 15, -1560198380);
    b = ii(b, c, d, a, k[13], 21, 1309151649);
    a = ii(a, b, c, d, k[4], 6, -145523070);
    d = ii(d, a, b, c, k[11], 10, -1120210379);
    c = ii(c, d, a, b, k[2], 15, 718787259);
    b = ii(b, c, d, a, k[9], 21, -343485551);

    x[0] = add32(a, x[0]);
    x[1] = add32(b, x[1]);
    x[2] = add32(c, x[2]);
    x[3] = add32(d, x[3]);
  }

  function md5blk(s) {
    const md5blks = [];
    // treat as UTF-8
    const enc = getEncoder();
    const bytes = enc ? enc.encode(s) : normalizeToBytes(s);

    for (let i = 0; i < 64; i += 4) {
      md5blks[i >> 2] =
        bytes[i] +
        (bytes[i + 1] << 8) +
        (bytes[i + 2] << 16) +
        (bytes[i + 3] << 24);
    }
    return md5blks;
  }

  function md51(s) {
    const enc = getEncoder();
    const bytes = enc ? enc.encode(s) : normalizeToBytes(s);

    const n = bytes.length;
    const state = [1732584193, -271733879, -1732584194, 271733878];

    // Process 64-byte chunks
    let i = 0;
    for (; i + 64 <= n; i += 64) {
      md5cycle(state, md5blkBytes(bytes.subarray(i, i + 64)));
    }

    // Tail
    const tail = new Uint8Array(64);
    tail.set(bytes.subarray(i));
    tail[n - i] = 0x80;

    // If there's not enough room for the length, do an extra block
    if (n - i > 55) {
      md5cycle(state, md5blkBytes(tail));
      tail.fill(0);
    }

    const bitLen = n * 8;
    tail[56] = bitLen & 0xff;
    tail[57] = (bitLen >>> 8) & 0xff;
    tail[58] = (bitLen >>> 16) & 0xff;
    tail[59] = (bitLen >>> 24) & 0xff;

    md5cycle(state, md5blkBytes(tail));

    return state;
  }

  function md5blkBytes(bytes) {
    const out = new Array(16);
    for (let i = 0; i < 64; i += 4) {
      out[i >> 2] =
        (bytes[i] || 0) +
        ((bytes[i + 1] || 0) << 8) +
        ((bytes[i + 2] || 0) << 16) +
        ((bytes[i + 3] || 0) << 24);
    }
    return out;
  }

  function rhex(n) {
    const s = "0123456789abcdef";
    let out = "";
    for (let j = 0; j < 4; j += 1) {
      out +=
        s.charAt((n >> (j * 8 + 4)) & 0x0f) + s.charAt((n >> (j * 8)) & 0x0f);
    }
    return out;
  }

  function hex(x) {
    for (let i = 0; i < x.length; i += 1) {
      x[i] = rhex(x[i]);
    }
    return x.join("");
  }

  function add32(a, b) {
    return (a + b) & 0xffffffff;
  }

  return hex(md51(str));
}
