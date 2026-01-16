import sql from "@/app/api/utils/sql";
import { collectOSINT } from "../osint/collector.js";
import {
  collectSocialData,
  createSocialProfile,
  collectSocialPosts,
} from "../osint/social.js"; // Updated import
import { performAIAnalysis } from "../analysis/ai.js";
import { extractGeoMarkers } from "../analysis/geo.js";
import { generateReportHTML } from "../reports/generator.js";
import { computeDeconfliction } from "../analysis/deconfliction/deconflict.js";
import {
  updateInvestigationStatus,
  insertOSINTData,
  insertAIAnalysis,
  insertGeoMarkers,
  insertReport,
  logEvent,
  insertProgressEvent,
} from "../utils/database.js";

export async function processInvestigation(
  investigationId,
  targetType,
  targetValue,
  options = {},
) {
  // helper to avoid repeating boilerplate + to tolerate progress logging failures
  const progress = async ({
    stepKey,
    stepLabel,
    eventStatus,
    percent,
    message,
  }) => {
    try {
      await insertProgressEvent(sql, investigationId, {
        stepKey,
        stepLabel,
        eventStatus,
        percent,
        message,
      });
    } catch (e) {
      console.error("Failed to write progress event", e);
    }
  };

  try {
    await progress({
      stepKey: "start",
      stepLabel: "Starting investigation",
      eventStatus: "started",
      percent: 1,
      message: "Queued and starting up",
    });

    // Update status to processing
    await updateInvestigationStatus(sql, investigationId, "processing");

    await progress({
      stepKey: "osint",
      stepLabel: "Collecting OSINT",
      eventStatus: "started",
      percent: 10,
      message: `Collecting open-source intel for ${targetType}`,
    });

    // Step 1: OSINT Collection (expanded multi-module)
    const osintData = await collectOSINT(targetType, targetValue, {
      includeNSFW:
        options.includeNSFW === undefined ? true : !!options.includeNSFW,
      includeWebScraping:
        options.includeWebScraping === undefined
          ? true
          : !!options.includeWebScraping,
      // pass deep image scan flag
      includeDeepImageScan: !!options.includeDeepImageScan,
      // pass deep OSINT scan flag
      includeDeepScan: !!options.includeDeepScan,
      // pass license plate lookup options
      includeLicensePlate:
        options.includeLicensePlate === undefined
          ? true
          : !!options.includeLicensePlate,
      licensePlateRegion: options.licensePlateRegion || null,

      // NEW: allow OSINT collection to stream sub-step updates into progress events
      onProgress: (p) => {
        const nextPercent =
          typeof p?.percent === "number" && Number.isFinite(p.percent)
            ? Math.min(29, Math.max(10, p.percent))
            : 10;
        const msg =
          typeof p?.message === "string" && p.message.trim()
            ? p.message.trim()
            : "Collecting OSINT…";

        return progress({
          stepKey: "osint",
          stepLabel: "Collecting OSINT",
          eventStatus: "info",
          percent: nextPercent,
          message: msg,
        });
      },
    });

    await insertOSINTData(sql, investigationId, osintData);

    await progress({
      stepKey: "osint",
      stepLabel: "Collecting OSINT",
      eventStatus: "completed",
      percent: 30,
      message: "OSINT collection saved",
    });

    // Step 1.5: Social Media Collection (Enhanced)
    let socialProfiles = [];
    try {
      await progress({
        stepKey: "social_profiles",
        stepLabel: "Searching social profiles",
        eventStatus: "started",
        percent: 35,
        message: "Looking for social profiles",
      });

      const socialResult = await processSocialMedia(
        investigationId,
        targetType,
        targetValue,
        options,
      );
      socialProfiles = socialResult.profiles || [];

      await progress({
        stepKey: "social_profiles",
        stepLabel: "Searching social profiles",
        eventStatus: "completed",
        percent: 45,
        message: `Found ${socialProfiles.length} profile(s)`,
      });
    } catch (socialError) {
      console.error("Social media collection failed:", socialError);

      await progress({
        stepKey: "social_profiles",
        stepLabel: "Searching social profiles",
        eventStatus: "failed",
        percent: 45,
        message: "Social profile search failed (continuing)",
      });

      await logEvent(
        sql,
        "social_collection_failed",
        "Social media collection failed but investigation continues",
        {
          investigation_id: investigationId,
          error: socialError.message,
        },
      );
    }

    // Step 1.6: NEW - Social Media Post Collection
    try {
      if (socialProfiles.length > 0) {
        await progress({
          stepKey: "social_posts",
          stepLabel: "Collecting social posts",
          eventStatus: "started",
          percent: 50,
          message: "Collecting recent posts",
        });

        await collectSocialPostsForInvestigation(
          investigationId,
          socialProfiles,
          options,
        );

        await progress({
          stepKey: "social_posts",
          stepLabel: "Collecting social posts",
          eventStatus: "completed",
          percent: 60,
          message: "Social posts saved",
        });
      } else {
        await progress({
          stepKey: "social_posts",
          stepLabel: "Collecting social posts",
          eventStatus: "info",
          percent: 60,
          message: "Skipped (no profiles found)",
        });
      }
    } catch (postError) {
      console.error("Social post collection failed:", postError);

      await progress({
        stepKey: "social_posts",
        stepLabel: "Collecting social posts",
        eventStatus: "failed",
        percent: 60,
        message: "Post collection failed (continuing)",
      });

      await logEvent(
        sql,
        "social_post_collection_failed",
        "Social post collection failed but investigation continues",
        {
          investigation_id: investigationId,
          error: postError.message,
        },
      );
    }

    await progress({
      stepKey: "ai",
      stepLabel: "Running AI analysis",
      eventStatus: "started",
      percent: 65,
      message: "Building summary, timeline, and risk signals",
    });

    // Step 2: AI Analysis (now includes timeline and associates)
    const aiAnalysis = await performAIAnalysis(osintData, {
      onProgress: (p) => {
        const nextPercentRaw =
          typeof p?.percent === "number" && Number.isFinite(p.percent)
            ? p.percent
            : null;
        const nextPercent =
          nextPercentRaw === null
            ? 66
            : Math.min(79, Math.max(66, nextPercentRaw));

        const msg =
          typeof p?.message === "string" && p.message.trim()
            ? p.message.trim()
            : "Running AI analysis…";

        return progress({
          stepKey: "ai",
          stepLabel: "Running AI analysis",
          eventStatus: "info",
          percent: nextPercent,
          message: msg,
        });
      },
    });

    await insertAIAnalysis(sql, investigationId, aiAnalysis);

    await progress({
      stepKey: "ai",
      stepLabel: "Running AI analysis",
      eventStatus: "completed",
      percent: 80,
      message: "AI results saved",
    });

    // Step 2.5: Deconfliction (flag conflicting metadata across sources)
    try {
      await progress({
        stepKey: "deconflict",
        stepLabel: "Deconflicting sources",
        eventStatus: "started",
        percent: 81,
        message: "Checking for conflicting identity metadata",
      });

      const deconfliction = computeDeconfliction(osintData, socialProfiles);
      await sql`
        INSERT INTO osint_raw (investigation_id, data_json)
        VALUES (${investigationId}, ${JSON.stringify(deconfliction)})
      `;

      const conflictsCount = Number(deconfliction?.counts?.total || 0);
      await progress({
        stepKey: "deconflict",
        stepLabel: "Deconflicting sources",
        eventStatus: "completed",
        percent: 82,
        message: conflictsCount
          ? `Flagged ${conflictsCount} conflict(s)`
          : "No conflicts flagged",
      });
    } catch (e) {
      console.error("Deconfliction step failed (continuing)", e);
      await progress({
        stepKey: "deconflict",
        stepLabel: "Deconflicting sources",
        eventStatus: "failed",
        percent: 82,
        message: "Deconfliction failed (continuing)",
      });
    }

    // Step 3: Generate geo markers from IP/network intel
    try {
      await progress({
        stepKey: "geo",
        stepLabel: "Generating map markers",
        eventStatus: "started",
        percent: 82,
        message: "Extracting location signals",
      });

      const markers = extractGeoMarkers(osintData, aiAnalysis);
      await insertGeoMarkers(
        sql,
        investigationId,
        markers,
        aiAnalysis.risk_level,
      );

      await progress({
        stepKey: "geo",
        stepLabel: "Generating map markers",
        eventStatus: "completed",
        percent: 88,
        message: `Added ${markers.length} marker(s)`,
      });
    } catch (err) {
      console.error("Geo marker creation failed", err);
      await progress({
        stepKey: "geo",
        stepLabel: "Generating map markers",
        eventStatus: "failed",
        percent: 88,
        message: "Map markers failed (continuing)",
      });
    }

    await progress({
      stepKey: "report",
      stepLabel: "Building report",
      eventStatus: "started",
      percent: 92,
      message: "Generating report view",
    });

    // Step 4: Generate report
    const reportHtml = generateReportHTML(osintData, aiAnalysis);

    await insertReport(sql, investigationId, reportHtml);

    await progress({
      stepKey: "report",
      stepLabel: "Building report",
      eventStatus: "completed",
      percent: 98,
      message: "Report saved",
    });

    // Update status to completed
    await updateInvestigationStatus(sql, investigationId, "completed", true);

    await progress({
      stepKey: "done",
      stepLabel: "Complete",
      eventStatus: "completed",
      percent: 100,
      message: "Investigation completed",
    });

    await logEvent(
      sql,
      "investigation_completed",
      "Investigation processing completed",
      {
        investigation_id: investigationId,
      },
    );
  } catch (error) {
    console.error("Error processing investigation:", error);

    await updateInvestigationStatus(sql, investigationId, "failed");

    await progress({
      stepKey: "failed",
      stepLabel: "Failed",
      eventStatus: "failed",
      percent: 100,
      message: error?.message || "Investigation failed",
    });

    await logEvent(
      sql,
      "investigation_failed",
      "Investigation processing failed",
      {
        investigation_id: investigationId,
        error: error.message,
      },
    );
  }
}

// Enhanced social media processing function
async function processSocialMedia(
  investigationId,
  targetType,
  targetValue,
  options,
) {
  // Check if social media collection is enabled
  const includeSocialMedia = options.includeSocialMedia !== false; // Default to true

  if (!includeSocialMedia) {
    console.log(
      "Social media collection disabled for investigation:",
      investigationId,
    );
    return { profiles: [] };
  }

  console.log(
    "Starting social media processing for investigation:",
    investigationId,
  );

  try {
    // Collect social profiles
    const socialData = await collectSocialData(targetType, targetValue, {
      socialPlatforms: options.socialPlatforms || [
        "twitter",
        "instagram",
        "linkedin",
        "facebook",
        "tiktok",
      ],
      includeNSFW: options.includeNSFW,
      enableRealTimeMonitoring: options.enableRealTimeMonitoring || false,
    });

    let totalProfilesStored = 0;
    let highConfidenceProfiles = [];
    let allStoredProfiles = [];

    // Store profiles in database
    for (const platformData of socialData) {
      if (platformData.success && platformData.profiles.length > 0) {
        for (const profile of platformData.profiles) {
          try {
            const profileId = await createSocialProfile(
              investigationId,
              profile,
            );
            totalProfilesStored++;

            // Store profile with database ID for later use
            const storedProfile = {
              ...profile,
              profile_id: profileId,
              investigation_id: investigationId,
            };
            allStoredProfiles.push(storedProfile);

            // Track high-confidence profiles for potential monitoring
            if (profile.confidence_score > 0.8) {
              highConfidenceProfiles.push(storedProfile);
            }

            console.log(
              `✓ Stored ${profile.platform} profile: ${profile.username} (confidence: ${profile.confidence_score})`,
            );
          } catch (profileError) {
            console.error(
              `Failed to store ${profile.platform} profile:`,
              profileError,
            );
          }
        }
      }
    }

    // Store raw social media data in osint_raw table
    await sql`
      INSERT INTO osint_raw (investigation_id, data_json)
      VALUES (${investigationId}, ${JSON.stringify({
        type: "social_media",
        platforms: socialData,
        summary: {
          total_platforms_searched: socialData.length,
          successful_platforms: socialData.filter((p) => p.success).length,
          total_profiles_found: totalProfilesStored,
          high_confidence_profiles: highConfidenceProfiles.length,
        },
        timestamp: new Date().toISOString(),
      })})
    `;

    // Set up monitoring for high-confidence profiles if enabled
    if (options.enableRealTimeMonitoring && highConfidenceProfiles.length > 0) {
      await startRealTimeMonitoring(investigationId, highConfidenceProfiles);
    }

    // Log success
    await logEvent(
      sql,
      "social_media_collected",
      `Social media collection completed: ${totalProfilesStored} profiles found`,
      {
        investigation_id: investigationId,
        target_type: targetType,
        profiles_count: totalProfilesStored,
        high_confidence_count: highConfidenceProfiles.length,
        platforms: socialData.map((p) => ({
          platform: p.platform,
          success: p.success,
          count: p.profiles.length,
        })),
      },
    );

    console.log(
      `✅ Social media processing completed: ${totalProfilesStored} profiles stored`,
    );

    return {
      profiles: allStoredProfiles,
      high_confidence_profiles: highConfidenceProfiles,
      total_profiles: totalProfilesStored,
    };
  } catch (error) {
    console.error("Social media processing failed:", error);

    // Log the error but don't fail the entire investigation
    await logEvent(
      sql,
      "social_media_error",
      "Social media processing encountered an error",
      {
        investigation_id: investigationId,
        target_type: targetType,
        target_value: targetValue,
        error_message: error.message,
        error_stack: error.stack,
      },
    );

    throw error; // Re-throw to be caught by main try-catch
  }
}

// NEW: Social Media Post Collection Function
async function collectSocialPostsForInvestigation(
  investigationId,
  profiles,
  options,
) {
  console.log(`🔍 Starting post collection for ${profiles.length} profiles...`);

  try {
    const postCollectionResult = await collectSocialPosts(
      investigationId,
      profiles,
      {
        maxPostsPerProfile: options.maxPostsPerProfile || 50,
        maxPreviewPosts: options.maxPreviewPosts || 200,
        minProfileConfidence:
          typeof options.minProfileConfidence === "number"
            ? options.minProfileConfidence
            : 0.65,
        includeAnalytics: true,
        detectPatterns: true,
      },
    );

    // Log post collection results
    await logEvent(
      sql,
      "social_posts_collected",
      `Social posts collection completed: ${postCollectionResult.analytics.total_posts} posts`,
      {
        investigation_id: investigationId,
        total_posts: postCollectionResult.analytics.total_posts,
        platforms: Object.keys(postCollectionResult.analytics.platforms),
        suspicious_patterns: postCollectionResult.suspicious_patterns.length,
        mentions_found: postCollectionResult.analytics.mentions_found.length,
        connections: postCollectionResult.analytics.connection_graph.length,
      },
    );

    console.log(
      `✅ Post collection completed: ${postCollectionResult.analytics.total_posts} posts from ${Object.keys(postCollectionResult.analytics.platforms).length} platforms`,
    );

    return postCollectionResult;
  } catch (error) {
    console.error("Failed to collect social posts:", error);

    await logEvent(
      sql,
      "social_posts_collection_failed",
      "Social posts collection failed",
      {
        investigation_id: investigationId,
        error_message: error.message,
        profiles_attempted: profiles.length,
      },
    );

    throw error;
  }
}

// Real-time monitoring setup function
async function startRealTimeMonitoring(investigationId, profiles) {
  console.log(
    `Setting up real-time monitoring for ${profiles.length} high-confidence profiles`,
  );

  try {
    for (const profile of profiles) {
      // Insert monitoring record
      await sql`
        INSERT INTO social_monitoring (
          investigation_id,
          platform,
          target_username,
          monitoring_active,
          last_checked,
          next_check_at
        ) VALUES (
          ${investigationId},
          ${profile.platform},
          ${profile.username},
          TRUE,
          NOW(),
          NOW() + INTERVAL '1 hour'
        )
        ON CONFLICT (investigation_id, platform, target_username) 
        DO UPDATE SET 
          monitoring_active = TRUE,
          next_check_at = NOW() + INTERVAL '1 hour'
      `;

      console.log(
        `✓ Monitoring enabled for ${profile.platform}:${profile.username}`,
      );
    }

    await logEvent(
      sql,
      "monitoring_started",
      `Real-time monitoring started for ${profiles.length} profiles`,
      {
        investigation_id: investigationId,
        profiles: profiles.map((p) => ({
          platform: p.platform,
          username: p.username,
        })),
      },
    );
  } catch (error) {
    console.error("Failed to start real-time monitoring:", error);

    await logEvent(
      sql,
      "monitoring_setup_failed",
      "Failed to set up real-time monitoring",
      {
        investigation_id: investigationId,
        error_message: error.message,
      },
    );
  }
}
