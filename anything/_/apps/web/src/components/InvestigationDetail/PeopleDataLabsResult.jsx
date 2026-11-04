export function PeopleDataLabsResult({ result }) {
  if (!result) return null;
  return (
    <div className="border border-[var(--st-line)] rounded-lg p-3 mb-4">
      <h4 className="font-semibold">People Data Labs</h4>
      <p className="text-sm">Status: {result.status}</p>
      <p className="text-xs text-[var(--st-muted)]">{result.message}</p>
      <p className="text-xs text-[var(--st-muted)]">Evaluated: {result.checked_at}</p>
      {result.status === 'matched' && result.record && (
        <>
          <p className="text-sm">Provider match likelihood: {result.likelihood}/10 (not independently verified)</p>
          <dl className="text-sm mt-2 space-y-1">
            {Object.entries(result.record).map(([key, value]) => (
              <div key={key}><dt className="inline font-medium">{key.replaceAll('_', ' ')}: </dt><dd className="inline">{String(value)}</dd></div>
            ))}
          </dl>
        </>
      )}
    </div>
  );
}
