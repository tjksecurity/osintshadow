import React from "react";
import { describe, expect, test, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";

import { InvestigationForm } from "./InvestigationForm";

describe("InvestigationForm", () => {
  test("shows a clear disabled hint when target value is empty", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <InvestigationForm
          targetType="email"
          setTargetType={vi.fn()}
          targetValue=""
          setTargetValue={vi.fn()}
          includeWebScraping={true}
          setIncludeWebScraping={vi.fn()}
          includeNSFW={true}
          setIncludeNSFW={vi.fn()}
          includeDeepImageScan={false}
          setIncludeDeepImageScan={vi.fn()}
          includeDeepScan={false}
          setIncludeDeepScan={vi.fn()}
          includeCriminal={true}
          setIncludeCriminal={vi.fn()}
          includeCourt={true}
          setIncludeCourt={vi.fn()}
          includeProperty={true}
          setIncludeProperty={vi.fn()}
          includeLicensePlate={false}
          setIncludeLicensePlate={vi.fn()}
          plateRegion="CA"
          setPlateRegion={vi.fn()}
          includeSocialMedia={true}
          setIncludeSocialMedia={vi.fn()}
          socialPlatforms={["twitter"]}
          setSocialPlatforms={vi.fn()}
          enableRealTimeMonitoring={false}
          setEnableRealTimeMonitoring={vi.fn()}
          includePostCollection={true}
          setIncludePostCollection={vi.fn()}
          submitting={false}
          error={""}
          errorCode={null}
          handleSubmit={vi.fn((e) => e?.preventDefault?.())}
          user={{ monthly_remaining: 0 }}
          isAdmin={false}
          isTrial={true}
        />,
      );
    });

    const button = container.querySelector('button[type="submit"]');
    expect(button).toBeTruthy();
    expect(button.disabled).toBe(true);

    expect(container.textContent).toContain("Enter a target to start");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
