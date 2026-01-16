import React from "react";
import { describe, expect, test } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";

import SocialPostsTab from "./SocialPostsTab";

describe("SocialPostsTab", () => {
  test("renders empty state when no social post analytics exists", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const investigation = {
      osint_raw: [],
    };

    await act(async () => {
      root.render(<SocialPostsTab investigation={investigation} />);
    });

    expect(container.textContent).toContain("No Social Media Posts");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
