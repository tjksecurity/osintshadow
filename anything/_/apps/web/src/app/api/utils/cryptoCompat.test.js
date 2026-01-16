import { describe, expect, test } from "vitest";
import { md5Hex, timingSafeEqualHex } from "./cryptoCompat.js";

describe("cryptoCompat", () => {
  test("md5Hex matches known test vectors", () => {
    expect(md5Hex("")).toBe("d41d8cd98f00b204e9800998ecf8427e");
    expect(md5Hex("test")).toBe("098f6bcd4621d373cade4e832627b4f6");
    expect(md5Hex("hello")).toBe("5d41402abc4b2a76b9719d911017c592");
  });

  test("timingSafeEqualHex compares equal-length hex strings", () => {
    expect(timingSafeEqualHex("aa", "aa")).toBe(true);
    expect(timingSafeEqualHex("aa", "ab")).toBe(false);
    expect(timingSafeEqualHex("aa", "aaa")).toBe(false);
  });
});
