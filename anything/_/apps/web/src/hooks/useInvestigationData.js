import { useMemo } from "react";

export function useInvestigationData(investigation) {
  const ai = useMemo(
    () => ({
      summary: investigation?.summary,
      anomalies: investigation?.anomalies,
      risk_score: investigation?.risk_score,
      full: investigation?.ai_analysis,
    }),
    [investigation],
  );

  const summaryPreview = useMemo(() => {
    if (!ai.summary) return null;
    const text = String(ai.summary);
    return text.length > 180 ? `${text.slice(0, 180)}…` : text;
  }, [ai.summary]);

  const anomaliesPreviewItems = useMemo(() => {
    if (!ai.anomalies) return [];
    const raw = String(ai.anomalies)
      .split(/\r?\n|\•|\-|\d+\./)
      .map((s) => s.trim())
      .filter(Boolean);
    return raw.slice(0, 4);
  }, [ai.anomalies]);

  const osint = investigation?.osint_data || {};

  const center = investigation?.geo_markers?.length
    ? {
        lat: Number(investigation.geo_markers[0].lat),
        lng: Number(investigation.geo_markers[0].lng),
      }
    : { lat: 20, lng: 0 };

  const confirmed = ai.full?.confirmed_data;
  const hasConfirmed = useMemo(() => {
    if (!confirmed) return false;
    const confirmedProfiles = (confirmed?.profiles || []).slice(0, 200);
    const confirmedPhones = (confirmed?.phones || []).slice(0, 200);
    const confirmedEmails = (confirmed?.emails || []).slice(0, 200);
    const confirmedDomains = (confirmed?.domains || []).slice(0, 200);
    const confirmedHandles = (confirmed?.handles || []).slice(0, 200);
    return (
      confirmedProfiles.length +
        confirmedPhones.length +
        confirmedEmails.length +
        confirmedDomains.length +
        confirmedHandles.length >
      0
    );
  }, [confirmed]);

  const imagesItems = osint?.images?.items || [];
  const hasImages = imagesItems.length > 0;

  return {
    ai,
    summaryPreview,
    anomaliesPreviewItems,
    osint,
    center,
    confirmed,
    hasConfirmed,
    imagesItems,
    hasImages,
  };
}
