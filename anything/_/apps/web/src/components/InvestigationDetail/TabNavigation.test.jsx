import React from "react";
import { describe, expect, test, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";

import { TabNavigation } from "./TabNavigation";

describe("TabNavigation", () => {
  test("renders Report tab right after Overview and clicking calls onTabChange", async () => {
    const onTabChange = vi.fn();

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TabNavigation activeTab="overview" onTabChange={onTabChange} />,
      );
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    expect(buttons.length).toBeGreaterThan(2);

    expect(buttons[0].textContent).toContain("Overview");
    expect(buttons[1].textContent).toContain("Report");

    await act(async () => {
      buttons[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onTabChange).toHaveBeenCalledWith("report");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
