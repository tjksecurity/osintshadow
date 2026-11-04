import { PUBLIC_SOURCES, safePublicSourceUrl } from '../../utils/publicSources.js';

export function PublicSourceResults({ results }) {
  if (!Array.isArray(results) || !results.length) return null;
  return <section className="rounded-xl border border-[var(--st-line)] bg-[var(--st-inset)] p-5 space-y-4" aria-label="Public profile sources">
    <div><h3 className="font-semibold text-lg">Public profile sources</h3>
      <p className="text-sm text-slate-300">Candidates and validation signals only. A shared name or handle does not establish identity or ownership.</p></div>
    {results.map((result, index) => <article key={`${result.provider}-${index}`} className="rounded-lg border border-[var(--st-line)] p-4 space-y-2">
      <h4 className="font-medium">{PUBLIC_SOURCES.find(s => s.id === result.provider)?.label || 'Public source'}</h4>
      <p className="text-xs uppercase tracking-wider text-[var(--st-accent)]">{typeof result.status === 'string' ? result.status.replaceAll('_', ' ') : 'Unavailable'}</p>
      <p className="text-sm text-slate-300">{typeof result.message === 'string' ? result.message : ''}</p>
      <p className="text-xs text-[var(--st-muted)]">Evaluated: {typeof result.evaluated_at === 'string' ? result.evaluated_at : 'Unknown'}</p>
      {result.truncated ? <p className="text-xs text-amber-300">Limited results; this is not an exhaustive search.</p> : null}
      {result.status === 'candidates_found' && Array.isArray(result.records) ? <ul className="space-y-2">{result.records.slice(0,5).map((record, i) => {
        const url = safePublicSourceUrl(record.url);
        return <li key={i} className="text-sm"><span>{url ? <a className="text-[var(--st-accent)] underline break-all" href={url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{record.label}</a> : record.label}</span>
          <span className="block text-xs text-[var(--st-muted)] break-all">Source ID: {record.id}</span>{record.context ? <span className="block text-slate-300">{record.context}</span> : null}</li>;
      })}</ul> : null}
      {result.status === 'validated' && typeof result.validation?.phone_valid === 'boolean' ? <div className="text-sm">
        <p>Number format/range: {result.validation.phone_valid ? 'Valid according to provider' : 'Not valid according to provider'}</p>
        {['phone_type','country_code','carrier'].map(key => typeof result.validation[key] === 'string' ? <p key={key}>{key.replaceAll('_', ' ')}: {result.validation[key]}</p> : null)}
      </div> : null}
    </article>)}
  </section>;
}
