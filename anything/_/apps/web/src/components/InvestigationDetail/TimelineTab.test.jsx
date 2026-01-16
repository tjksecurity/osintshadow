import React from "react";
import { describe, expect, test } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";

import TimelineTab from "./TimelineTab";

describe("TimelineTab", () => {
  test("renders timeline events when ai_analysis is the full JSON object", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const investigation = {
      ai_analysis: {
        timeline_events: {
          events: [
            {
              title: "Test event",
              timestamp: "2025-01-01T00:00:00Z",
              description: "Something happened",
              severity: "low",
              event_type: "account_creation",
              source: "unit_test",
              details: { foo: "bar" },
            },
          ],
        },
      },
    };

    await act(async () => {
      root.render(<TimelineTab investigation={investigation} />);
    });

    expect(container.textContent).toContain("Investigation Timeline");
    expect(container.textContent).toContain("Test event");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
