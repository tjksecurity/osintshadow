import { describe, it, expect } from "vitest";
import { PLATFORM_CONFIGS, DEFAULT_MIN_CONFIDENCE } from "./platformConfigs.js";

describe("social platform configs", () => {
  it("supports name searches on common platforms", () => {
    expect(PLATFORM_CONFIGS.twitter.searchEndpoints).toContain("name");
    expect(PLATFORM_CONFIGS.instagram.searchEndpoints).toContain("name");
    expect(PLATFORM_CONFIGS.linkedin.searchEndpoints).toContain("name");
  });

  it("uses a reasonable default confidence threshold", () => {
    expect(DEFAULT_MIN_CONFIDENCE).toBeLessThanOrEqual(0.5);
  });
});
