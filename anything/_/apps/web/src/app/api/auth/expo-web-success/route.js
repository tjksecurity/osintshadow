import { getToken } from "@auth/core/jwt";
import { randomBytes } from "node:crypto";

function parentOrigin() {
  const configured = process.env.EXPO_AUTH_PARENT_ORIGIN;
  if (!configured) return null; // Same-origin embedding is the default.
  const url = new URL(configured);
  const local =
    process.env.NODE_ENV !== "production" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" && !(local && url.protocol === "http:"))
  ) {
    throw new Error("Invalid authentication parent origin");
  }
  return url.origin;
}

function authPage(message, allowedOrigin, status) {
  const nonce = randomBytes(18).toString("base64");
  // JWT profile fields can contain HTML. Keep them inside the JSON script value.
  const payload = JSON.stringify(message)
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
  const target = allowedOrigin
    ? JSON.stringify(allowedOrigin)
    : "window.location.origin";
  const headers = {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy":
      "default-src 'none'; base-uri 'none'; script-src 'nonce-" +
      nonce +
      "'; frame-ancestors " +
      (allowedOrigin || "'self'") +
      ";",
  };
  if (!allowedOrigin) headers["X-Frame-Options"] = "SAMEORIGIN";
  return new Response(
    '<!doctype html><html><body><script nonce="' +
      nonce +
      '">window.parent.postMessage(' +
      payload +
      ", " +
      target +
      ");</script></body></html>",
    { status, headers },
  );
}

export async function GET(request) {
  if (!process.env.AUTH_SECRET) {
    return Response.json(
      { error: "Authentication is unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    // Only server configuration can opt into a cross-origin auth bridge.
    // Query parameters and referrer headers cannot choose the token recipient.
    const allowedOrigin = parentOrigin();
    const secureCookie =
      new URL(process.env.AUTH_URL || request.url).protocol === "https:";
    const options = {
      req: request,
      secret: process.env.AUTH_SECRET,
      secureCookie,
    };
    const [token, jwt] = await Promise.all([
      getToken({ ...options, raw: true }),
      getToken(options),
    ]);
    if (!jwt || !token) {
      return authPage(
        { type: "AUTH_ERROR", error: "Unauthorized" },
        allowedOrigin,
        401,
      );
    }
    return authPage(
      {
        type: "AUTH_SUCCESS",
        jwt: token,
        user: { id: jwt.sub, email: jwt.email, name: jwt.name },
      },
      allowedOrigin,
      200,
    );
  } catch {
    return Response.json(
      { error: "Authentication is unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

