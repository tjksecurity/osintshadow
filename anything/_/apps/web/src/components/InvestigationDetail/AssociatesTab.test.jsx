import React from "react";
import { describe, expect, test } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";

import AssociatesTab from "./AssociatesTab";

describe("AssociatesTab", () => {
  test("does not crash when associate fields are missing", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const investigation = {
      ai_analysis: {
        associates_analysis: [
          {
            // missing name/contexts/etc on purpose
            relationship_type: "family",
            confidence: 0.9,
            sources: [],
          },
        ],
      },
    };

    await act(async () => {
      root.render(<AssociatesTab investigation={investigation} />);
    });

    expect(container.textContent).toContain("Known Associates");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
