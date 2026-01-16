import { auth } from "@/auth";
import sql from "@/app/api/utils/sql";
import {
  insertProgressEvent,
  logEvent,
  updateInvestigationStatus,
  insertOSINTData,
  insertAIAnalysis,
  insertGeoMarkers,
  insertReport,
} from "../../utils/database.js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STEP_ORDER = [
  "osint",
  "social_profiles",
  "social_posts",
  "ai",
  "deconflict",
  "geo",
  "report",
];

function createToken() {
  return `tick_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

// NEW: lightweight debug id (also returned to the client)
function createDebugId() {
  return `dbg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// NEW: safe JSON stringify for logs (never throw from logging)
function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch (e) {
    return JSON.stringify({
      error: "Could not serialize value",
      message: e?.message,
    });
  }
}

async function safeProgress(investigationId, data) {
  try {
    await insertProgressEvent(sql, investigationId, data);
  } catch (e) {
    console.error("Failed to write progress event", e);
  }
}

// NEW: log helper that can never crash the request
async function safeLog(logType, message, metadata) {
  try {
    await logEvent(sql, logType, message, metadata);
  } catch (e) {
    console.warn("Failed to write log event", logType, e);
  }
}

function nextStepFromEvents(events) {
  const finished = new Set();

  for (const e of events) {
    const key = e?.step_key;
    const status = e?.event_status;
    if (!key) continue;
    if (status === "completed" || status === "failed") {
      finished.add(key);
    }
  }

  for (const step of STEP_ORDER) {
    if (!finished.has(step)) {
      return step;
    }
  }

  return null;
}

export async function POST(request, { params }) {
  const idRaw = params?.id;
  const debugId = createDebugId();
  const cacheHeaders = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "x-debug-id": debugId,
  };

  // Normalize id early to avoid edge-case type issues
  const id = Number(idRaw);

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json(
        { error: "Unauthorized", code: "UNAUTHORIZED", debugId },
        { status: 401, headers: cacheHeaders },
      );
    }

    if (!idRaw || !Number.isFinite(id)) {
      return Response.json(
        {
          error: "Missing/invalid investigation id",
          code: "MISSING_ID",
          debugId,
        },
        { status: 400, headers: cacheHeaders },
      );
    }

    // Breadcrumb log: proves the route is running in production.
    await safeLog("investigation_tick_called", "Tick invoked", {
      debug_id: debugId,
      investigation_id: id,
      user_id: session.user.id,
      at: new Date().toISOString(),
    });

    // Read the investigation row first so we can do a friendly response quickly.
    const invRows = await sql`
      SELECT id, user_id, status, target_type, target_value, processing_flags,
             processing_locked_until, processing_lock_token
      FROM investigations
      WHERE id = ${id} AND user_id = ${session.user.id}
      LIMIT 1
    `;

    if (invRows.length === 0) {
      return Response.json(
        { error: "Investigation not found", code: "NOT_FOUND", debugId },
        { status: 404, headers: cacheHeaders },
      );
    }

    const inv = invRows[0];

    if (inv.status === "completed" || inv.status === "failed") {
      return Response.json(
        {
          ok: true,
          message: `No tick needed (status=${inv.status})`,
          id: inv.id,
          status: inv.status,
          debugId,
        },
        { headers: cacheHeaders },
      );
    }

    // Attempt to claim a short-lived lock so multiple ticks don't run at the same time.
    const token = createToken();
    const claimed = await sql`
      UPDATE investigations
      SET processing_locked_until = NOW() + INTERVAL '2 minutes',
          processing_lock_token = ${token},
          processing_last_tick_at = NOW()
      WHERE id = ${id}
        AND user_id = ${session.user.id}
        AND status IN ('queued', 'processing')
        AND (
          processing_locked_until IS NULL
          OR processing_locked_until < NOW()
          OR (processing_last_tick_at IS NOT NULL AND processing_last_tick_at < NOW() - INTERVAL '3 minutes')
        )
      RETURNING id
    `;

    if (claimed.length === 0) {
      return Response.json(
        {
          ok: true,
          message: "Tick skipped (another tick is in progress)",
          id: inv.id,
          status: inv.status,
          debugId,
        },
        { status: 202, headers: cacheHeaders },
      );
    }

    // Make sure we're marked as processing (safe/idempotent)
    if (inv.status === "queued") {
      await updateInvestigationStatus(sql, inv.id, "processing");
      await safeProgress(inv.id, {
        stepKey: "start",
        stepLabel: "Starting investigation",
        eventStatus: "started",
        percent: 1,
        message: "Processing started",
      });
    }

    // Determine next step from the existing progress events.
    const recent = await sql`
      SELECT step_key, event_status
      FROM investigation_progress_events
      WHERE investigation_id = ${id}
      ORDER BY id DESC
      LIMIT 300
    `;

    const nextStep = nextStepFromEvents(recent);

    if (!nextStep) {
      // All steps finished; mark completed if we haven't already.
      await updateInvestigationStatus(sql, inv.id, "completed", true);
      await safeProgress(inv.id, {
        stepKey: "done",
        stepLabel: "Complete",
        eventStatus: "completed",
        percent: 100,
        message: "Investigation completed",
      });

      // Release lock
      await sql`
        UPDATE investigations
        SET processing_locked_until = NULL,
            processing_lock_token = NULL
        WHERE id = ${id}
      `;

      return Response.json(
        { ok: true, id: inv.id, status: "completed", debugId },
        { headers: cacheHeaders },
      );
    }

    const flags = inv.processing_flags || {};

    // Helper to ensure we always release the lock
    const releaseLock = async () => {
      try {
        await sql`
          UPDATE investigations
          SET processing_locked_until = NULL,
              processing_lock_token = NULL
          WHERE id = ${id} AND processing_lock_token = ${token}
        `;
      } catch (e) {
        console.warn("Failed to release tick lock", e);
      }
    };

    try {
      if (nextStep === "osint") {
        await safeProgress(inv.id, {
          stepKey: "osint",
          stepLabel: "Collecting OSINT",
          eventStatus: "started",
          percent: 10,
          message: `Collecting open-source intel for ${inv.target_type}`,
        });

        const { collectOSINT } = await import("../../osint/collector.js");

        // IMPORTANT: OSINT is best-effort. If any provider times out (AbortError)
        // we should NOT fail the entire investigation.
        let osintData;
        try {
          osintData = await collectOSINT(inv.target_type, inv.target_value, {
            includeNSFW:
              flags.includeNSFW === undefined ? true : !!flags.includeNSFW,
            includeWebScraping:
              flags.includeWebScraping === undefined
                ? true
                : !!flags.includeWebScraping,
            includeDeepImageScan: !!flags.includeDeepImageScan,
            includeDeepScan: !!flags.includeDeepScan,
            includeLicensePlate:
              flags.includeLicensePlate === undefined
                ? true
                : !!flags.includeLicensePlate,
            licensePlateRegion: flags.licensePlateRegion || null,
            onProgress: (p) => {
              const nextPercent =
                typeof p?.percent === "number" && Number.isFinite(p.percent)
                  ? Math.min(29, Math.max(10, p.percent))
                  : 10;
              const msg =
                typeof p?.message === "string" && p.message.trim()
                  ? p.message.trim()
                  : "Collecting OSINT…";
              return safeProgress(inv.id, {
                stepKey: "osint",
                stepLabel: "Collecting OSINT",
                eventStatus: "info",
                percent: nextPercent,
                message: msg,
              });
            },
          });
        } catch (e) {
          console.error("OSINT collection threw (best-effort, continuing)", e);
          osintData = {
            target_type: inv.target_type,
            target_value: inv.target_value,
            collected_at: new Date().toISOString(),
            error: e?.message || "OSINT collection failed",
          };
        }

        await insertOSINTData(sql, inv.id, osintData);

        const osintErrorMsg =
          typeof osintData?.error === "string" && osintData.error.trim()
            ? osintData.error.trim()
            : null;

        await safeProgress(inv.id, {
          stepKey: "osint",
          stepLabel: "Collecting OSINT",
          eventStatus: "completed",
          percent: 30,
          message: osintErrorMsg
            ? `OSINT saved with warnings: ${osintErrorMsg}`
            : "OSINT collection saved",
        });
      } else if (nextStep === "social_profiles") {
        const includeSocialMedia = flags.includeSocialMedia !== false;

        if (!includeSocialMedia) {
          await safeProgress(inv.id, {
            stepKey: "social_profiles",
            stepLabel: "Searching social profiles",
            eventStatus: "completed",
            percent: 45,
            message: "Skipped (disabled)",
          });
        } else {
          await safeProgress(inv.id, {
            stepKey: "social_profiles",
            stepLabel: "Searching social profiles",
            eventStatus: "started",
            percent: 35,
            message: "Looking for social profiles",
          });

          try {
            const { collectSocialData, createSocialProfile } = await import(
              "../../osint/social.js"
            );

            // NEW: seed DB social_profiles from OSINT username checks
            // This makes Social Media + Posts work even if search engines block.
            const seedRows = await sql`
              SELECT data_json
              FROM osint_raw
              WHERE investigation_id = ${inv.id}
              ORDER BY id ASC
              LIMIT 1
            `;

            const osintSeed = seedRows?.[0]?.data_json || null;

            const rawOsintProfiles = Array.isArray(osintSeed?.social?.profiles)
              ? osintSeed.social.profiles
              : Array.isArray(osintSeed?.username?.profiles)
                ? osintSeed.username.profiles
                : [];

            const platformToId = (name) => {
              const n = String(name || "").toLowerCase();
              if (n.includes("github")) return "github";
              if (n.includes("reddit")) return "reddit";
              if (n.includes("twitter") || n === "x") return "twitter";
              if (n.includes("instagram")) return "instagram";
              if (n.includes("tiktok")) return "tiktok";
              if (n.includes("youtube")) return "youtube";
              if (n.includes("facebook")) return "facebook";
              if (n.includes("linkedin")) return "linkedin";
              return null;
            };

            const seedsToStore = rawOsintProfiles
              .filter((p) => p?.exists && p?.profile_url && p?.username)
              .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
              .slice(0, 15);

            let seededCount = 0;

            for (const p of seedsToStore) {
              const platformId = platformToId(p.platform);
              if (!platformId) continue;

              try {
                const existing = await sql`
                  SELECT id
                  FROM social_profiles
                  WHERE investigation_id = ${inv.id}
                    AND platform = ${platformId}
                    AND username = ${p.username}
                  LIMIT 1
                `;

                if (existing.length > 0) {
                  continue;
                }

                await createSocialProfile(inv.id, {
                  platform: platformId,
                  username: p.username,
                  display_name: p?.meta?.display_name || p.username,
                  profile_url: p.profile_url,
                  bio: p?.meta?.bio || null,
                  verified: false,
                  confidence_score:
                    typeof p.confidence === "number" ? p.confidence : 0.5,
                  discovery_method: "osint_username_check",
                  metadata: {
                    source: "osint.usernameIntel",
                    platform_name: p.platform,
                    platform_category: p.platform_category,
                    match_evidence: p.match_evidence || null,
                    risk_hints: p.risk_hints || null,
                    meta: p.meta || null,
                  },
                });

                seededCount += 1;
              } catch (e) {
                console.warn("Failed to seed social profile", e);
              }
            }

            const socialData = await collectSocialData(
              inv.target_type,
              inv.target_value,
              {
                socialPlatforms: flags.socialPlatforms || [
                  "twitter",
                  "instagram",
                  "linkedin",
                  "facebook",
                  "tiktok",
                ],
                includeNSFW: flags.includeNSFW,
                enableRealTimeMonitoring: !!flags.enableRealTimeMonitoring,
                // NEW: let name searches return candidates too (the default used to be overly strict)
                minConfidence:
                  inv.target_type === "username"
                    ? 0.6
                    : inv.target_type === "email" || inv.target_type === "phone"
                      ? 0.45
                      : inv.target_type === "name"
                        ? 0.35
                        : 0.4,
              },
            );

            let totalProfilesStored = seededCount;
            const allStoredProfiles = [];

            const monitoringEnabled = !!flags.enableRealTimeMonitoring;

            for (const platformData of socialData) {
              if (
                platformData?.success &&
                Array.isArray(platformData.profiles)
              ) {
                for (const profile of platformData.profiles) {
                  try {
                    const profileId = await createSocialProfile(
                      inv.id,
                      profile,
                    );
                    totalProfilesStored += 1;
                    allStoredProfiles.push({
                      ...profile,
                      profile_id: profileId,
                      investigation_id: inv.id,
                    });

                    // NEW: if real-time monitoring is enabled, register this profile for future checks.
                    // We keep it idempotent by checking if a monitoring row already exists.
                    if (
                      monitoringEnabled &&
                      profile?.username &&
                      profile?.platform
                    ) {
                      try {
                        const existing = await sql`
                          SELECT id
                          FROM social_monitoring
                          WHERE investigation_id = ${inv.id}
                            AND platform = ${profile.platform}
                            AND target_username = ${profile.username}
                          LIMIT 1
                        `;

                        if (existing.length === 0) {
                          await sql`
                            INSERT INTO social_monitoring (
                              investigation_id,
                              platform,
                              target_username,
                              monitoring_active,
                              last_checked,
                              posts_collected,
                              api_calls_used,
                              error_count,
                              next_check_at
                            ) VALUES (
                              ${inv.id},
                              ${profile.platform},
                              ${profile.username},
                              true,
                              NULL,
                              0,
                              0,
                              0,
                              NOW()
                            )
                          `;
                        }
                      } catch (e) {
                        console.warn("Failed to register social monitoring", e);
                      }
                    }
                  } catch (e) {
                    console.error("Failed to store social profile", e);
                  }
                }
              }
            }

            await sql`
              INSERT INTO osint_raw (investigation_id, data_json)
              VALUES (${inv.id}, ${JSON.stringify({
                type: "social_media",
                platforms: socialData,
                summary: {
                  total_platforms_searched: Array.isArray(socialData)
                    ? socialData.length
                    : 0,
                  successful_platforms: Array.isArray(socialData)
                    ? socialData.filter((p) => p?.success).length
                    : 0,
                  total_profiles_found: totalProfilesStored,
                },
                stored_profiles: allStoredProfiles,
                timestamp: new Date().toISOString(),
              })})
            `;

            await safeProgress(inv.id, {
              stepKey: "social_profiles",
              stepLabel: "Searching social profiles",
              eventStatus: "completed",
              percent: 45,
              message: `Found ${totalProfilesStored} profile(s)`,
            });
          } catch (socialError) {
            console.error(
              "Social profile search failed (continuing)",
              socialError,
            );

            await safeProgress(inv.id, {
              stepKey: "social_profiles",
              stepLabel: "Searching social profiles",
              eventStatus: "failed",
              percent: 45,
              message: "Social profile search failed (continuing)",
            });

            try {
              await logEvent(
                sql,
                "social_collection_failed",
                "Social media collection failed but investigation continues",
                {
                  investigation_id: inv.id,
                  error: socialError?.message,
                },
              );
            } catch (_) {}
          }
        }
      } else if (nextStep === "social_posts") {
        // Social posts step depends on profiles existing.
        // collectSocialPosts expects each profile to include profile_id and confidence_score.
        const profiles = await sql`
          SELECT
            id as profile_id,
            platform,
            username,
            display_name,
            profile_url,
            (COALESCE(risk_score, 0) / 100.0) as confidence_score
          FROM social_profiles
          WHERE investigation_id = ${inv.id}
          ORDER BY id ASC
        `;

        if (!profiles || profiles.length === 0) {
          await safeProgress(inv.id, {
            stepKey: "social_posts",
            stepLabel: "Collecting social posts",
            eventStatus: "completed",
            percent: 60,
            message: "Skipped (no profiles found)",
          });
        } else {
          await safeProgress(inv.id, {
            stepKey: "social_posts",
            stepLabel: "Collecting social posts",
            eventStatus: "started",
            percent: 50,
            message: "Collecting recent posts",
          });

          try {
            const { collectSocialPosts } = await import(
              "../../osint/social.js"
            );

            await collectSocialPosts(inv.id, profiles, {
              maxPostsPerProfile: flags.maxPostsPerProfile || 50,
              maxPreviewPosts: flags.maxPreviewPosts || 200,
              minProfileConfidence:
                typeof flags.minProfileConfidence === "number"
                  ? flags.minProfileConfidence
                  : 0.5,
              includeAnalytics: true,
              detectPatterns: true,
            });

            await safeProgress(inv.id, {
              stepKey: "social_posts",
              stepLabel: "Collecting social posts",
              eventStatus: "completed",
              percent: 60,
              message: "Social posts saved",
            });
          } catch (postError) {
            console.error(
              "Social post collection failed (continuing)",
              postError,
            );

            await safeProgress(inv.id, {
              stepKey: "social_posts",
              stepLabel: "Collecting social posts",
              eventStatus: "failed",
              percent: 60,
              message: "Post collection failed (continuing)",
            });

            try {
              await logEvent(
                sql,
                "social_post_collection_failed",
                "Social post collection failed but investigation continues",
                {
                  investigation_id: inv.id,
                  error: postError?.message,
                },
              );
            } catch (_) {}
          }
        }
      } else if (nextStep === "ai") {
        await safeProgress(inv.id, {
          stepKey: "ai",
          stepLabel: "Running AI analysis",
          eventStatus: "started",
          percent: 65,
          message: "Building summary, timeline, and risk signals",
        });

        // Grab the earliest OSINT row as the primary OSINT bundle.
        const osintRows = await sql`
          SELECT id, data_json
          FROM osint_raw
          WHERE investigation_id = ${inv.id}
          ORDER BY id ASC
          LIMIT 1
        `;

        const osintData = osintRows?.[0]?.data_json;
        if (!osintData) {
          throw new Error("Missing OSINT data; cannot run AI analysis");
        }

        const { performAIAnalysis } = await import("../../analysis/ai.js");

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

            return safeProgress(inv.id, {
              stepKey: "ai",
              stepLabel: "Running AI analysis",
              eventStatus: "info",
              percent: nextPercent,
              message: msg,
            });
          },
        });

        await insertAIAnalysis(sql, inv.id, aiAnalysis);

        await safeProgress(inv.id, {
          stepKey: "ai",
          stepLabel: "Running AI analysis",
          eventStatus: "completed",
          percent: 80,
          message: "AI results saved",
        });
      } else if (nextStep === "deconflict") {
        // Non-fatal step. If it fails, we continue.
        await safeProgress(inv.id, {
          stepKey: "deconflict",
          stepLabel: "Deconflicting sources",
          eventStatus: "started",
          percent: 81,
          message: "Checking for conflicting identity metadata",
        });

        try {
          const osintRows = await sql`
            SELECT id, data_json
            FROM osint_raw
            WHERE investigation_id = ${inv.id}
            ORDER BY id ASC
            LIMIT 1
          `;

          const osintData = osintRows?.[0]?.data_json;

          const profiles = await sql`
            SELECT id, platform, username, display_name
            FROM social_profiles
            WHERE investigation_id = ${inv.id}
            ORDER BY id ASC
          `;

          const { computeDeconfliction } = await import(
            "../../analysis/deconfliction/deconflict.js"
          );

          const deconfliction = computeDeconfliction(osintData, profiles);

          await sql`
            INSERT INTO osint_raw (investigation_id, data_json)
            VALUES (${inv.id}, ${JSON.stringify(deconfliction)})
          `;

          const conflictsCount = Number(deconfliction?.counts?.total || 0);

          await safeProgress(inv.id, {
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

          await safeProgress(inv.id, {
            stepKey: "deconflict",
            stepLabel: "Deconflicting sources",
            eventStatus: "failed",
            percent: 82,
            message: "Deconfliction failed (continuing)",
          });
        }
      } else if (nextStep === "geo") {
        await safeProgress(inv.id, {
          stepKey: "geo",
          stepLabel: "Generating map markers",
          eventStatus: "started",
          percent: 82,
          message: "Extracting location signals",
        });

        try {
          const osintRows = await sql`
            SELECT id, data_json
            FROM osint_raw
            WHERE investigation_id = ${inv.id}
            ORDER BY id ASC
            LIMIT 1
          `;

          const osintData = osintRows?.[0]?.data_json;

          const aiRows = await sql`
            SELECT full_json
            FROM ai_output
            WHERE investigation_id = ${inv.id}
            ORDER BY id DESC
            LIMIT 1
          `;

          const aiAnalysis = aiRows?.[0]?.full_json || null;

          const { extractGeoMarkers } = await import("../../analysis/geo.js");

          const markers = extractGeoMarkers(osintData, aiAnalysis);

          await insertGeoMarkers(sql, inv.id, markers, aiAnalysis?.risk_level);

          await safeProgress(inv.id, {
            stepKey: "geo",
            stepLabel: "Generating map markers",
            eventStatus: "completed",
            percent: 88,
            message: `Added ${markers.length} marker(s)`,
          });
        } catch (e) {
          console.error("Geo marker creation failed", e);

          await safeProgress(inv.id, {
            stepKey: "geo",
            stepLabel: "Generating map markers",
            eventStatus: "failed",
            percent: 88,
            message: "Map markers failed (continuing)",
          });
        }
      } else if (nextStep === "report") {
        await safeProgress(inv.id, {
          stepKey: "report",
          stepLabel: "Building report",
          eventStatus: "started",
          percent: 92,
          message: "Generating report view",
        });

        const osintRows = await sql`
          SELECT id, data_json
          FROM osint_raw
          WHERE investigation_id = ${inv.id}
          ORDER BY id ASC
          LIMIT 1
        `;

        const osintData = osintRows?.[0]?.data_json;
        if (!osintData) {
          throw new Error("Missing OSINT data; cannot build report");
        }

        const aiRows = await sql`
          SELECT full_json
          FROM ai_output
          WHERE investigation_id = ${inv.id}
          ORDER BY id DESC
          LIMIT 1
        `;

        const aiAnalysis = aiRows?.[0]?.full_json || null;

        const { generateReportHTML } = await import(
          "../../reports/generator.js"
        );

        const reportHtml = generateReportHTML(osintData, aiAnalysis);

        await insertReport(sql, inv.id, reportHtml);

        await safeProgress(inv.id, {
          stepKey: "report",
          stepLabel: "Building report",
          eventStatus: "completed",
          percent: 98,
          message: "Report saved",
        });

        await updateInvestigationStatus(sql, inv.id, "completed", true);

        await safeProgress(inv.id, {
          stepKey: "done",
          stepLabel: "Complete",
          eventStatus: "completed",
          percent: 100,
          message: "Investigation completed",
        });

        try {
          await logEvent(
            sql,
            "investigation_completed",
            "Investigation processing completed",
            { investigation_id: inv.id },
          );
        } catch (_) {}
      }

      await releaseLock();

      return Response.json(
        {
          ok: true,
          id: inv.id,
          status: "processing",
          ranStep: nextStep,
          debugId,
        },
        { headers: cacheHeaders },
      );
    } catch (stepError) {
      console.error(`Tick step failed (${nextStep}):`, stepError);

      // Mark as failed and record the failure so we don't stall forever.
      await updateInvestigationStatus(sql, inv.id, "failed");

      await safeProgress(inv.id, {
        stepKey: "failed",
        stepLabel: "Failed",
        eventStatus: "failed",
        percent: 100,
        message: stepError?.message || "Investigation failed",
      });

      await safeLog("investigation_tick_failed", "Tick step failed", {
        debug_id: debugId,
        investigation_id: inv.id,
        user_id: session.user.id,
        step: nextStep,
        error_message: stepError?.message,
        error_stack: stepError?.stack,
        error_name: stepError?.name,
        flags_json: safeJson(flags),
        at: new Date().toISOString(),
      });

      await releaseLock();

      return Response.json(
        {
          error: "Tick failed",
          code: "TICK_FAILED",
          step: nextStep,
          details: stepError?.message || "Unknown error",
          debugId,
        },
        { status: 500, headers: cacheHeaders },
      );
    }
  } catch (error) {
    console.error("Error ticking investigation:", error);

    await safeLog("investigation_tick_unhandled", "Unhandled tick error", {
      debug_id: debugId,
      investigation_id: Number.isFinite(id) ? id : idRaw,
      error_message: error?.message,
      error_stack: error?.stack,
      error_name: error?.name,
      at: new Date().toISOString(),
    });

    return Response.json(
      {
        error: "Failed to tick investigation",
        code: "TICK_INTERNAL_ERROR",
        details: error?.message || "Unknown error",
        debugId,
      },
      { status: 500, headers: cacheHeaders },
    );
  }
}
