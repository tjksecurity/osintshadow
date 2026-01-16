import { DEFAULT_MIN_CONFIDENCE } from "./platformConfigs.js";
import { searchPlatform } from "./platformSearch.js";
import { calculateConfidence } from "./confidenceCalculator.js";

/**
 * Main social media data collection function
 * Integrates with existing OSINT collector pattern
 */
export async function collectSocialData(targetType, targetValue, flags = {}) {
  console.log("Starting social media collection:", { targetType, targetValue });

  const platforms = flags.socialPlatforms || [
    "twitter",
    "instagram",
    "linkedin",
    "facebook",
    "tiktok",
  ];
  const minConfidence =
    typeof flags.minConfidence === "number"
      ? Math.max(0, Math.min(1, flags.minConfidence))
      : DEFAULT_MIN_CONFIDENCE;

  const results = [];

  for (const platform of platforms) {
    console.log(`Collecting data from ${platform}...`);

    try {
      let profiles = await searchPlatform(
        platform,
        targetType,
        targetValue,
        flags,
      );

      // Filter low-confidence matches to improve accuracy
      const preFilterCount = profiles?.length || 0;
      profiles = (profiles || []).filter((p) => {
        const c = calculateConfidence(p, targetType, targetValue);
        p.confidence_score = c;
        return c >= minConfidence;
      });
      const filteredCount = profiles.length;

      if (profiles && profiles.length > 0) {
        results.push({
          platform,
          success: true,
          profiles: profiles.map((profile) => ({
            ...profile,
            discovery_method: `${targetType}_search`,
            platform,
          })),
          metadata: {
            search_type: targetType,
            search_value: targetValue,
            results_count: profiles.length,
            discarded_low_confidence: preFilterCount - filteredCount,
            min_confidence_threshold: minConfidence,
            timestamp: new Date().toISOString(),
          },
        });

        console.log(
          `✓ Found ${profiles.length} high-confidence profiles on ${platform} (discarded ${preFilterCount - filteredCount})`,
        );
      } else {
        results.push({
          platform,
          success: true,
          profiles: [],
          metadata: {
            search_type: targetType,
            search_value: targetValue,
            results_count: 0,
            discarded_low_confidence: preFilterCount - filteredCount,
            min_confidence_threshold: minConfidence,
            timestamp: new Date().toISOString(),
          },
        });

        console.log(`✓ No high-confidence profiles found on ${platform}`);
      }
    } catch (error) {
      console.error(`${platform} collection failed:`, error);

      results.push({
        platform,
        success: false,
        error: error.message,
        profiles: [],
        metadata: {
          search_type: targetType,
          search_value: targetValue,
          error_message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  console.log(
    `Social media collection completed. Found profiles on ${results.filter((r) => r.success && r.profiles.length > 0).length} platforms`,
  );

  return results;
}
