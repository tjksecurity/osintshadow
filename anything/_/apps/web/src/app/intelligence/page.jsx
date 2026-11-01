"use client";

import { useEffect, useRef, useState } from "react";
import useUser from "@/utils/useUser";
import BrandLogo from "@/components/BrandLogo";
import { captureFingerprint, getVisitorTracking, enableVisitorTracking, disableVisitorTracking } from "@/features/intelligence/browser-client";
import { exampleDataset, trainClassifier } from "@/features/intelligence/classifier";

const buttonClass = "rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white";
const inputClass = "w-full rounded-lg border border-slate-500 bg-slate-900 px-3 py-2 text-white";
const VISITOR_NAMESPACE = "osintshadow_visitor";

function Result({ value, error }) {
  if (error) return <p role="alert" className="mt-3 break-words text-red-300">{error}</p>;
  if (value === null || value === undefined) return null;
  return <pre aria-label="Tool result" className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950 p-3 text-xs text-slate-200">{JSON.stringify(value, null, 2)}</pre>;
}

function ToolCard({ title, description, children }) {
  return <section className="min-w-0 rounded-xl border border-slate-600 bg-[#232D41] p-5">
    <h2 className="text-lg font-semibold text-white">{title}</h2>
    <p className="mb-4 mt-2 text-sm leading-relaxed text-slate-300">{description}</p>
    {children}
  </section>;
}

function ProviderTool({ title, description, action, field, label, placeholder, type = "text" }) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function run(event) {
    event.preventDefault();
    setBusy(true); setError(""); setResult(null);
    const active = new AbortController();
    controller.current = active;
    const timer = setTimeout(() => active.abort(), 65000);
    try {
      const response = await fetch("/api/intelligence", {
        method: "POST", credentials: "same-origin", signal: active.signal,
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ action, input: { [field]: input.trim() } }),
      });
      let payload;
      try { payload = await response.json(); } catch { throw new Error("The server returned an unreadable response."); }
      if (!response.ok || !payload.ok) {
        const message = payload.error?.message || (typeof payload.error === "string" ? payload.error : "The request failed.");
        const missing = payload.missing?.length ? ` Required: ${payload.missing.join(", ")}.` : "";
        const retry = payload.error?.retryAfter !== undefined ? ` Retry after ${payload.error.retryAfter} seconds.` : "";
        throw new Error(`${message}${missing}${retry}`);
      }
      setResult(payload.data);
    } catch (failure) {
      if (controller.current === active) setError(active.signal.aborted ? "Request cancelled or timed out. No result was verified." : failure.message);
    } finally {
      clearTimeout(timer);
      if (controller.current === active) { controller.current = null; setBusy(false); }
    }
  }
  return <ToolCard title={title} description={description}>
    {action === "breach" && <p className="mb-3 text-sm text-slate-300">Breach data supplied by <a href="https://haveibeenpwned.com/" target="_blank" rel="noreferrer" className="underline">Have I Been Pwned</a>.</p>}
    {action === "ipinfo" && <p className="mb-3 text-sm text-slate-300">IP address data supplied by <a href="https://ipinfo.io/" target="_blank" rel="noreferrer" className="underline">IPinfo</a>.</p>}
    <form onSubmit={run} className="space-y-3">
      <label className="block text-sm text-slate-200">{label}<input required maxLength={1024} type={type} value={input} onChange={(event) => setInput(event.target.value)} placeholder={placeholder} className={`${inputClass} mt-1`} /></label>
      <button disabled={busy} className={buttonClass} type="submit">{busy ? "Working…" : `Run ${title}`}</button>
    </form>
    <Result value={result} error={error} />
  </ToolCard>;
}

function BrowserTools() {
  const [fingerprint, setFingerprint] = useState(null);
  const [fingerprintError, setFingerprintError] = useState("");
  const [fingerprintBusy, setFingerprintBusy] = useState(false);
  const [tracking, setTracking] = useState({ enabled: false, visitorId: null });
  const [cookieError, setCookieError] = useState("");
  useEffect(() => {
    try { setTracking(getVisitorTracking(VISITOR_NAMESPACE)); } catch (failure) { setCookieError(failure.message); }
  }, []);
  async function capture() {
    setFingerprintBusy(true); setFingerprintError("");
    try { setFingerprint(await captureFingerprint()); } catch (failure) { setFingerprintError(failure.message); }
    finally { setFingerprintBusy(false); }
  }
  function cookie(enabled) {
    setCookieError("");
    try { setTracking(enabled ? enableVisitorTracking(VISITOR_NAMESPACE) : disableVisitorTracking(VISITOR_NAMESPACE)); }
    catch (failure) { setCookieError(failure.message); }
  }
  return <>
    <ToolCard title="Browser fingerprint" description="Capture the characteristics of this browser on request. The fingerprint is a browser signal and does not establish a person's identity.">
      <button type="button" onClick={capture} disabled={fingerprintBusy} className={buttonClass}>{fingerprintBusy ? "Capturing…" : "Capture this browser"}</button>
      <Result value={fingerprint} error={fingerprintError} />
    </ToolCard>
    <ToolCard title="Visitor cookie" description="Enable a unique visitor identifier for this app in this browser. It lasts up to one year and can be revoked here. The identifier is separate from your account session.">
      <p role="status" className="mb-3 text-sm text-slate-200">{tracking.enabled ? "Visitor cookie enabled" : "Visitor cookie disabled"}</p>
      <div className="flex flex-wrap gap-3"><button type="button" onClick={() => cookie(true)} className={buttonClass}>Enable visitor cookie</button><button type="button" onClick={() => cookie(false)} className="rounded-lg border border-slate-400 px-4 py-2 text-white">Revoke visitor cookie</button></div>
      <Result value={tracking.enabled ? tracking : null} error={cookieError} />
    </ToolCard>
  </>;
}

function ClassifierTool() {
  const [dataset, setDataset] = useState(null);
  const [source, setSource] = useState("");
  const [epochs, setEpochs] = useState(10);
  const [progress, setProgress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [trained, setTrained] = useState(null);
  const [features, setFeatures] = useState("");
  const [prediction, setPrediction] = useState(null);
  const model = useRef(null);
  const controller = useRef(null);
  useEffect(() => () => { controller.current?.abort(); model.current?.dispose(); }, []);
  function clearModel() { model.current?.dispose(); model.current = null; setTrained(null); setPrediction(null); }
  async function upload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(""); clearModel();
    try {
      if (file.size > 2_000_000) throw new Error("Choose a JSON dataset smaller than 2 MB.");
      const parsed = JSON.parse(await file.text());
      if (!parsed || !Array.isArray(parsed.samples) || !Array.isArray(parsed.featureNames)) throw new Error("Dataset needs featureNames and samples arrays. Load the example to see the format.");
      setDataset(parsed); setSource(file.name); setProgress("");
    } catch (failure) { setDataset(null); setSource(""); setError(failure.message); }
  }
  function loadExample() { clearModel(); setDataset(exampleDataset()); setSource("Synthetic example data"); setError(""); setProgress(""); }
  function downloadExample() {
    try {
      const url = URL.createObjectURL(new Blob([JSON.stringify(exampleDataset(), null, 2)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = "classifier-example.json"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) { setError(failure.message); }
  }
  async function train() {
    if (!dataset) return;
    setBusy(true); setError(""); clearModel();
    const active = new AbortController(); controller.current = active;
    try {
      const result = await trainClassifier(dataset, { epochs: Number(epochs), batchSize: 32, signal: active.signal, onEpoch: (epoch) => { if (!active.signal.aborted) setProgress(`Completed epoch ${epoch} of ${epochs}`); } });
      if (active.signal.aborted) { result.dispose(); return; }
      model.current = result; setTrained({ metrics: result.metrics, featureNames: result.featureNames, source, synthetic: Boolean(dataset.synthetic) });
      setFeatures(result.featureNames.map(() => "0").join(", ")); setProgress("Training complete. Evaluation uses held-out rows.");
    } catch (failure) { setError(active.signal.aborted ? "Training cancelled." : failure.message); }
    finally { if (controller.current === active) { controller.current = null; setBusy(false); } }
  }
  async function predict(event) {
    event.preventDefault(); setError("");
    try {
      if (!model.current) throw new Error("Train a model first.");
      if (!features.trim()) throw new Error("Enter one numeric value for each feature.");
      const values = features.split(",").map((value) => value.trim() === "" ? NaN : Number(value.trim()));
      setPrediction(await model.current.predict(values));
    } catch (failure) { setError(failure.message); }
  }
  return <ToolCard title="Response classifier" description="Train a browser-local TensorFlow binary classifier with two 64-unit hidden layers and a sigmoid output. Your numeric features and 0/1 labels define the prediction; the result does not establish that a message causes persuasion.">
    <div className="space-y-3">
      <p className="text-sm text-slate-300">Upload JSON with featureNames and samples containing numeric features and label 0 or 1. Use 20–5,000 rows, up to 32 features, and both classes. Data and model stay in this browser tab.</p>
      <label className="block text-sm text-slate-200">Training dataset<input type="file" accept=".json,application/json" onChange={upload} disabled={busy} className="mt-1 block w-full text-sm" /></label>
      <div className="flex flex-wrap gap-3"><button type="button" onClick={loadExample} disabled={busy} className="rounded-lg border border-slate-400 px-3 py-2 text-sm disabled:opacity-50">Load synthetic example</button><button type="button" onClick={downloadExample} className="rounded-lg border border-slate-400 px-3 py-2 text-sm">Download JSON format</button></div>
      {dataset && <p className="text-sm text-slate-200">{source}: {dataset.samples.length} rows · {dataset.featureNames.length} features{dataset.synthetic ? " · synthetic demonstration" : ""}</p>}
      <label className="block text-sm text-slate-200">Epochs<input type="number" min="1" max="50" value={epochs} disabled={busy} onChange={(event) => setEpochs(event.target.value)} className={`${inputClass} mt-1`} /></label>
      <div className="flex flex-wrap gap-3"><button type="button" onClick={train} disabled={busy || !dataset} className={buttonClass}>{busy ? "Training…" : "Train and evaluate"}</button>{busy && <button type="button" onClick={() => controller.current?.abort()} className="rounded-lg border border-slate-400 px-4 py-2">Cancel training</button>}</div>
      {progress && <p role="status" className="text-sm text-slate-200">{progress}</p>}
      <Result value={trained} />
      {trained && <form onSubmit={predict} className="space-y-3"><label className="block text-sm text-slate-200">Prediction features ({trained.featureNames.join(", ")})<input required value={features} onChange={(event) => setFeatures(event.target.value)} className={`${inputClass} mt-1`} /></label><button type="submit" className={buttonClass}>Predict response</button></form>}
      <Result value={prediction} error={error} />
    </div>
  </ToolCard>;
}

export default function IntelligencePage() {
  const { data: user, loading } = useUser();
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Intelligence tools | ShadowTrace";
    return () => { document.title = previousTitle; };
  }, []);
  if (loading) return <main className="min-h-screen bg-[#263043] p-8 text-white"><p role="status">Checking your session…</p></main>;
  if (!user) return <main className="min-h-screen bg-[#263043] p-8 text-white"><h1 className="text-2xl font-semibold">Intelligence tools</h1><p className="my-4">Sign in to use these tools.</p><a className="text-cyan-300 underline" href="/account/signin?callbackUrl=%2Fintelligence">Sign in</a></main>;
  return <main className="min-h-screen bg-[#263043] p-4 text-white sm:p-8">
    <div className="mx-auto max-w-7xl">
      <header className="mb-7 flex flex-wrap items-center justify-between gap-4"><a href="/dashboard" aria-label="Return to dashboard"><BrandLogo className="h-7 w-auto" variant="onDark" /></a><nav aria-label="Intelligence navigation" className="flex gap-5 text-sm"><a href="/dashboard" className="text-cyan-300 hover:underline">Dashboard</a><a href="/investigations" className="text-cyan-300 hover:underline">Investigations</a></nav></header>
      <h1 className="text-3xl font-semibold">Intelligence tools</h1>
      <p className="mb-7 mt-3 max-w-3xl text-slate-300">Run a specific lookup, inspect the current browser, or train a response classifier. Each tool runs when you choose its action. External lookups send the entered value to the named source.</p>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <BrowserTools />
        <ProviderTool title="IP geolocation" description="Look up an explicit public IP address with IPinfo. Results describe the network and approximate location; they do not establish a person's identity or exact position." action="ipinfo" field="ip" label="Public IP address" placeholder="8.8.8.8" />
        <ProviderTool title="Breach lookup" description="Check an email address against Have I Been Pwned. No matching breaches is reported separately from missing configuration or a failed request." action="breach" field="email" label="Email address" placeholder="name@example.com" type="email" />
        <ProviderTool title="X profile" description="Read the public name, bio, and stated location from an X profile using the configured browser. Unavailable fields and login barriers remain explicit." action="profile" field="username" label="X username" placeholder="username" />
        <ProviderTool title="Onion page" description="Retrieve one onion page using the configured Tor proxy. The page is shown as text and never executed here. A successful fetch does not establish anonymity." action="onion" field="url" label="Onion page URL" placeholder="http://your-service-address.onion/" type="url" />
        <ClassifierTool />
      </div>
    </div>
  </main>;
}
