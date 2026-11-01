import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  user: { data: { id: "synthetic-user" }, loading: false },
  capture: vi.fn(), getTracking: vi.fn(), enable: vi.fn(), disable: vi.fn(), train: vi.fn(), predict: vi.fn(), dispose: vi.fn(),
}));
vi.mock("@/utils/useUser", () => ({ default: () => mocks.user }));
vi.mock("@/components/BrandLogo", () => ({ default: () => <span>OSINTShadow</span> }));
vi.mock("@/features/intelligence/browser-client", () => ({
  captureFingerprint: mocks.capture, getVisitorTracking: mocks.getTracking, enableVisitorTracking: mocks.enable, disableVisitorTracking: mocks.disable,
}));
vi.mock("@/features/intelligence/classifier", () => ({
  exampleDataset: () => ({ synthetic: true, featureNames: ["clarity", "relevance"], samples: Array.from({ length: 20 }, (_, i) => ({ features: [i / 20, i / 20], label: i % 2 })) }),
  trainClassifier: mocks.train,
}));
import IntelligencePage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { data: { id: "synthetic-user" }, loading: false };
  mocks.getTracking.mockReturnValue({ enabled: false, visitorId: null });
  mocks.enable.mockReturnValue({ enabled: true, visitorId: "synthetic-visitor" });
  mocks.disable.mockReturnValue({ enabled: false, visitorId: null });
  mocks.capture.mockResolvedValue({ visitorId: "synthetic-fingerprint", scope: "current_browser" });
  mocks.predict.mockResolvedValue({ probability: 0.75, label: 1 });
  mocks.train.mockResolvedValue({ metrics: { trainCount: 16, testCount: 4, loss: 0.4, accuracy: 0.75, precision: 0.75, recall: 0.75 }, featureNames: ["clarity", "relevance"], predict: mocks.predict, dispose: mocks.dispose });
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Unexpected network request")));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Intelligence tools interactions", () => {
  it("requires sign-in and performs no collection when signed out", () => {
    mocks.user = { data: null, loading: false };
    render(<IntelligencePage />);
    expect(document.title).toBe("Intelligence tools | ShadowTrace");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/account/signin?callbackUrl=%2Fintelligence");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(mocks.capture).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("shows all seven tools and runs fingerprint/cookie collection only on request", async () => {
    render(<IntelligencePage />);
    for (const title of ["Browser fingerprint", "Visitor cookie", "IP geolocation", "Breach lookup", "X profile", "Onion page", "Response classifier"]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }
    expect(mocks.capture).not.toHaveBeenCalled(); expect(mocks.enable).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Capture this browser" }));
    await screen.findByText(/synthetic-fingerprint/);
    expect(mocks.capture).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Enable visitor cookie" }));
    expect(screen.getByText("Visitor cookie enabled")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Revoke visitor cookie" }));
    expect(screen.getByText("Visitor cookie disabled")).toBeInTheDocument();
    expect(mocks.enable).toHaveBeenCalledOnce(); expect(mocks.disable).toHaveBeenCalledOnce();
  });
  it("submits the explicit IP and displays the returned provider record", async () => {
    fetch.mockResolvedValueOnce(Response.json({ ok: true, data: { ip: "8.8.8.8", evidence: "synthetic provider response" } }));
    render(<IntelligencePage />);
    fireEvent.change(screen.getByLabelText("Public IP address"), { target: { value: "8.8.8.8" } });
    fireEvent.click(screen.getByRole("button", { name: "Run IP geolocation" }));
    await screen.findByText(/synthetic provider response/);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe("/api/intelligence");
    expect(JSON.parse(options.body)).toEqual({ action: "ipinfo", input: { ip: "8.8.8.8" } });
    expect(options.credentials).toBe("same-origin");
  });
  it("shows configuration and rate-limit failures without reporting a successful lookup", async () => {
    fetch.mockResolvedValueOnce(Response.json({ ok: false, error: { code: "RATE_LIMITED", message: "Provider rate limit reached.", retryAfter: 45 } }, { status: 429 }));
    render(<IntelligencePage />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "synthetic@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Run Breach lookup" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Provider rate limit reached. Retry after 45 seconds.");
    expect(screen.queryByLabelText("Tool result")).not.toBeInTheDocument();
  });
  it("trains the selected synthetic dataset, shows held-out metrics, predicts and disposes the model", async () => {
    const rendered = render(<IntelligencePage />);
    expect(screen.getByRole("button", { name: "Train and evaluate" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Load synthetic example" }));
    expect(screen.getByText(/Synthetic example data: 20 rows/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Train and evaluate" }));
    await screen.findByText(/Training complete. Evaluation uses held-out rows./);
    expect(mocks.train).toHaveBeenCalledOnce();
    expect(mocks.train.mock.calls[0][0].samples).toHaveLength(20);
    expect(mocks.train.mock.calls[0][1]).toMatchObject({ epochs: 10, batchSize: 32 });
    fireEvent.change(screen.getByLabelText(/Prediction features/), { target: { value: "0.8, 0.9" } });
    fireEvent.click(screen.getByRole("button", { name: "Predict response" }));
    await screen.findByText(/"probability": 0.75/);
    expect(mocks.predict).toHaveBeenCalledWith([0.8, 0.9]);
    rendered.unmount();
    expect(mocks.dispose).toHaveBeenCalledOnce();
  });
  it("uploads the user's dataset rather than silently replacing it with an example", async () => {
    const dataset = { featureNames: ["custom_feature"], samples: Array.from({ length: 20 }, (_, i) => ({ features: [i], label: i % 2 })) };
    render(<IntelligencePage />);
    fireEvent.change(screen.getByLabelText("Training dataset"), { target: { files: [{ name: "owned-data.json", size: 1000, text: async () => JSON.stringify(dataset) }] } });
    await screen.findByText(/owned-data.json: 20 rows/);
    fireEvent.click(screen.getByRole("button", { name: "Train and evaluate" }));
    await waitFor(() => expect(mocks.train).toHaveBeenCalledOnce());
    expect(mocks.train.mock.calls[0][0]).toEqual(dataset);
  });
});
