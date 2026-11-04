export function InformationCard() {
  return (
    <div className="bg-[var(--st-panel)] rounded-lg p-6 mt-6">
      <h3 className="font-semibold mb-4">What happens next?</h3>
      <div className="space-y-3 text-sm text-slate-300">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 bg-[rgb(var(--st-accent-rgb))]/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-[var(--st-accent)] text-xs font-bold">1</span>
          </div>
          <div>
            <p className="font-medium">OSINT Data Collection</p>
            <p className="text-[var(--st-muted)]">
              We'll gather publicly available information from various sources
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 bg-[rgb(var(--st-accent-rgb))]/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-[var(--st-accent)] text-xs font-bold">2</span>
          </div>
          <div>
            <p className="font-medium">AI Analysis</p>
            <p className="text-[var(--st-muted)]">
              Our AI will analyze the data for patterns and risk factors
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 bg-[rgb(var(--st-accent-rgb))]/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-[var(--st-accent)] text-xs font-bold">3</span>
          </div>
          <div>
            <p className="font-medium">Report Generation</p>
            <p className="text-[var(--st-muted)]">
              A comprehensive report will be generated with findings and
              recommendations
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
