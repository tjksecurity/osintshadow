export function CreditsWarning({ monthlyRemaining, unlimited = false, isTrial = false, loading = false, error = null }) {
  if (loading || error) {
    return <p className="text-slate-300">{error ? 'Could not load current credits. Refresh to retry.' : 'Checking credits...'}</p>;
  }
  if (unlimited) {
    return <p className="text-green-400">Unlimited investigation credits — no credits are deducted.</p>;
  }
  if (isTrial) {
    return <p className="text-slate-300">Trial account — your trial allowance is checked when starting.</p>;
  }
  if (monthlyRemaining <= 0) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
        <p className="text-red-400">
          You have no credits remaining. Please{" "}
          <a href="/billing" className="underline">
            upgrade your plan
          </a>{" "}
          to continue creating investigations.
        </p>
      </div>
    );
  }

  if (monthlyRemaining > 0 && monthlyRemaining <= 3) {
    return (
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
        <p className="text-yellow-400">
          You have {monthlyRemaining} credits remaining this month.
        </p>
      </div>
    );
  }

  return null;
}
