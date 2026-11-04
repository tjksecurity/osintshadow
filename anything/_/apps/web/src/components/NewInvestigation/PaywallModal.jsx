export function PaywallModal({ showPaywall, setShowPaywall, errorCode }) {
  if (!showPaywall) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[var(--st-panel)] border border-[var(--st-line)] rounded-lg p-6 w-[90%] max-w-[520px]">
        <h3 className="text-lg font-semibold mb-2">Upgrade required</h3>
        <p className="text-slate-300 mb-4">
          {errorCode === "TRIAL_EXCEEDED"
            ? "Your trial allows 1 simple investigation. Upgrade to unlock full OSINT and unlimited runs."
            : "You do not have enough credits to start a new investigation."}
        </p>
        <div className="flex items-center justify-end gap-3">
          <button
            className="px-4 py-2 border border-[var(--st-line)] rounded hover:bg-[var(--st-hover)]"
            onClick={() => setShowPaywall(false)}
          >
            Close
          </button>
          <a
            href="/billing"
            className="px-4 py-2 bg-[var(--st-accent)] text-[var(--st-bg)] rounded hover:bg-[var(--st-accent-hover)]"
          >
            View plans
          </a>
        </div>
      </div>
    </div>
  );
}
