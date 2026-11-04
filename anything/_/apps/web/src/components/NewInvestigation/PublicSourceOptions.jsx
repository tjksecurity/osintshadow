import { PUBLIC_SOURCES, normalizePublicSources } from '../../utils/publicSources.js';

export function PublicSourceOptions({ targetType, publicSources = [], setPublicSources, isTrial = false }) {
  const selected = normalizePublicSources(publicSources);
  const compatible = PUBLIC_SOURCES.filter(source => source.targets.includes(targetType));
  return <fieldset className="rounded-xl border border-slate-600 p-4 space-y-3" disabled={isTrial}>
    <legend className="px-2 text-sm font-semibold">Public profile sources</legend>
    <p className="text-xs text-slate-300">Optional lookups send your supplied target to selected providers. Requires server setup.
      Provider limits are separate from ShadowTrace credits, including unlimited accounts. Matches are candidates, not verified identity.</p>
    {isTrial ? <p className="text-xs text-amber-300">Unavailable during the trial.</p> : null}
    <div className="flex gap-3 text-xs">
      <button type="button" className="underline text-cyan-300 py-2 focus-visible:ring-2" disabled={!compatible.length} onClick={() => setPublicSources?.(compatible.map(source => source.id))}>Select compatible sources</button>
      <button type="button" className="underline text-slate-300 py-2 focus-visible:ring-2" onClick={() => setPublicSources?.([])}>Clear selection</button>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {PUBLIC_SOURCES.map(source => {
        const supported = source.targets.includes(targetType);
        return <label key={source.id} className={`flex gap-3 rounded-lg border border-slate-700 p-3 ${supported ? '' : 'opacity-60'}`}>
          <input type="checkbox" checked={!isTrial && supported && selected.includes(source.id)} disabled={!supported}
            onChange={event => setPublicSources?.(event.target.checked ? [...selected.filter(id => id !== source.id), source.id] : selected.filter(id => id !== source.id))}
            className="mt-1 accent-cyan-400 focus-visible:ring-2" />
          <span><span className="block text-sm font-medium">{source.label}</span><span className="block text-xs text-slate-300">{source.detail}</span>
            {!supported ? <span className="block text-xs text-slate-400">For {source.targets.join(' or ')} targets</span> : null}</span>
        </label>;
      })}
    </div>
  </fieldset>;
}
