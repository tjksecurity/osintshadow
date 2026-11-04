import { TargetTypeSelector } from "./TargetTypeSelector";
import { TargetValueInput } from "./TargetValueInput";
import { SearchOptions } from "./SearchOptions";
import { AdvancedOptions } from "./AdvancedOptions";
import { targetTypes } from "./targetTypes";
import { PublicSourceOptions } from './PublicSourceOptions';

export function InvestigationForm({
  targetType,
  setTargetType,
  targetValue,
  setTargetValue,
  includeWebScraping,
  setIncludeWebScraping,
  includeNSFW,
  setIncludeNSFW,
  includeDeepImageScan,
  setIncludeDeepImageScan,
  includeDeepScan,
  setIncludeDeepScan,
  includePeopleDataLabs = false,
  setIncludePeopleDataLabs,
  publicSources = [],
  setPublicSources,
  includeCriminal,
  setIncludeCriminal,
  includeCourt,
  setIncludeCourt,
  includeProperty,
  setIncludeProperty,
  includeLicensePlate,
  setIncludeLicensePlate,
  plateRegion,
  setPlateRegion,
  // Social Media Props
  includeSocialMedia,
  setIncludeSocialMedia,
  socialPlatforms,
  setSocialPlatforms,
  enableRealTimeMonitoring,
  setEnableRealTimeMonitoring,
  // NEW: Post collection
  includePostCollection,
  setIncludePostCollection,
  submitting,
  error,
  errorCode,
  handleSubmit,
  user,
  hasUnlimitedCredits = false,
  creditsPending = false,
  creditError = null,
  isTrial,
}) {
  const selectedType = targetTypes.find((t) => t.value === targetType);

  const hasTargetValue = !!targetValue.trim();
  const hasCredits = (user?.monthly_remaining || 0) > 0;

  const isDisabled =
    submitting || creditsPending || !!creditError || !hasTargetValue || (!hasUnlimitedCredits && !isTrial && !hasCredits);

  let disabledReason = null;
  if (creditError) {
    disabledReason = "Could not verify current credits";
  } else if (creditsPending) {
    disabledReason = "Checking credits...";
  } else if (!hasTargetValue) {
    disabledReason = "Enter a target to start";
  } else if (!hasUnlimitedCredits && !isTrial && !hasCredits) {
    disabledReason = "No credits remaining";
  }

  return (
    <div className="max-w-2xl">
      <div className="bg-[#2D384E] rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-6">Investigation Details</h2>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-6">
            <p className="text-red-400 text-sm">{error}</p>
            {errorCode && (
              <p className="text-red-400 text-xs mt-1">Code: {errorCode}</p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <TargetTypeSelector
            targetTypes={targetTypes}
            targetType={targetType}
            setTargetType={setTargetType}
          />

          <TargetValueInput
            selectedType={selectedType}
            targetValue={targetValue}
            setTargetValue={setTargetValue}
            targetType={targetType}
            plateRegion={plateRegion}
            setPlateRegion={setPlateRegion}
          />

          <SearchOptions
            includeWebScraping={includeWebScraping}
            setIncludeWebScraping={setIncludeWebScraping}
            includeNSFW={includeNSFW}
            setIncludeNSFW={setIncludeNSFW}
            includeProperty={includeProperty}
            setIncludeProperty={setIncludeProperty}
            includeCourt={includeCourt}
            setIncludeCourt={setIncludeCourt}
            includeCriminal={includeCriminal}
            setIncludeCriminal={setIncludeCriminal}
            targetType={targetType}
            includeLicensePlate={includeLicensePlate}
            setIncludeLicensePlate={setIncludeLicensePlate}
            includePostCollection={includePostCollection}
            setIncludePostCollection={setIncludePostCollection}
          />

          <AdvancedOptions
            includeDeepScan={includeDeepScan}
            setIncludeDeepScan={setIncludeDeepScan}
            includeDeepImageScan={includeDeepImageScan}
            setIncludeDeepImageScan={setIncludeDeepImageScan}
            includeSocialMedia={includeSocialMedia}
            setIncludeSocialMedia={setIncludeSocialMedia}
            socialPlatforms={socialPlatforms}
            setSocialPlatforms={setSocialPlatforms}
            enableRealTimeMonitoring={enableRealTimeMonitoring}
            setEnableRealTimeMonitoring={setEnableRealTimeMonitoring}
          />

          <PublicSourceOptions targetType={targetType} publicSources={publicSources} setPublicSources={setPublicSources} isTrial={isTrial} />

          <label className="flex items-start gap-3 p-3 rounded-md border border-[#37425B]">
            <input
              type="checkbox"
              checked={includePeopleDataLabs && !isTrial && ['email', 'domain'].includes(targetType)}
              disabled={isTrial || !['email', 'domain'].includes(targetType)}
              onChange={(event) => setIncludePeopleDataLabs?.(event.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="block font-medium text-sm">People Data Labs enrichment (optional)</span>
              <span className="block text-xs text-slate-400">
                Send this email or domain to People Data Labs for professional or company data.
                Requires server configuration. Provider credits are separate from your
                ShadowTrace credits, including unlimited accounts. Matches are not verified identity.
                {isTrial ? ' Unavailable during the trial.' : !['email', 'domain'].includes(targetType) ? ' Select an email or domain target.' : ''}
              </span>
            </span>
          </label>

          <div className="flex items-center justify-between pt-4">
            <div className="text-sm text-slate-400">
              {creditError || creditsPending ? null : hasUnlimitedCredits
                ? 'Unlimited investigation credits — no credits are deducted.'
                : isTrial ? 'One trial investigation; no paid credits are deducted.'
                : `This will use 1 credit from your remaining ${user?.monthly_remaining ?? 0} credits`}
              {disabledReason ? (
                <div className="text-xs text-slate-500 mt-1">
                  {disabledReason}
                </div>
              ) : null}
            </div>
            <button
              type="submit"
              disabled={isDisabled}
              className="px-6 py-3 bg-[#00D1FF] text-[#263043] font-semibold rounded-lg hover:bg-[#00B8E6] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Starting Investigation..." : "Start Investigation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
