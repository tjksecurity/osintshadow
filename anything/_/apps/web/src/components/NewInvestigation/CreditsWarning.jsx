export function CreditsWarning({ monthlyRemaining }) {
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
