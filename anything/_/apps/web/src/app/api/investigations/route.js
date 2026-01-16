import { auth } from "@/auth";
import sql from "@/app/api/utils/sql";
import {
  checkAuthentication,
  checkUserCredits,
  deductUserCredit,
} from "./utils/auth.js";
import {
  createInvestigation,
  logEvent,
  insertProgressEvent,
} from "./utils/database.js";

export async function GET(request) {
  try {
    const { authenticated, userId } = await checkAuthentication(auth);
    if (!authenticated) {
      return Response.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    const url = new URL(request.url);
    const limitParam = url.searchParams.get("limit");
    // Default to 50, but allow up to 1000. If limit is "all" or -1, use 1000.
    let limit = 50;
    if (limitParam === "all" || limitParam === "-1") {
      limit = 1000;
    } else if (limitParam) {
      limit = parseInt(limitParam) || 50;
    }

    const offset = parseInt(url.searchParams.get("offset")) || 0;
    const status = url.searchParams.get("status");

    let query = `
      SELECT i.*, 
             ai.risk_score,
             r.pdf_url,
             COUNT(*) OVER() as total_count
      FROM investigations i
      LEFT JOIN ai_output ai ON i.id = ai.investigation_id
      LEFT JOIN reports r ON i.id = r.investigation_id
      WHERE i.user_id = $1
    `;
    const params = [userId];

    if (status) {
      query += ` AND i.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY i.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const investigations = await sql(query, params);

    return Response.json({
      investigations,
      total: investigations.length > 0 ? investigations[0].total_count : 0,
    });
  } catch (error) {
    console.error("Error fetching investigations:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request) {
  let investigationId = null; // Track for cleanup on errors

  try {
    console.log("=== INVESTIGATION API START ===");
    console.log("Request method:", request.method);
    console.log("Request URL:", request.url);
    console.log(
      "Request headers:",
      Object.fromEntries(request.headers.entries()),
    );

    // Authentication check with detailed logging
    console.log("=== AUTHENTICATION CHECK ===");
    let authResult;
    try {
      authResult = await checkAuthentication(auth);
      console.log("Authentication result:", authResult);
    } catch (authError) {
      console.error("Authentication check failed:", authError);
      return Response.json(
        { error: "Authentication failed", code: "AUTH_FAILED" },
        { status: 500 },
      );
    }

    const { authenticated, userId, email } = authResult;
    if (!authenticated) {
      console.log("Authentication failed - no valid session");
      return Response.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    console.log("✓ Authentication successful - User:", userId, email);

    // Request body parsing with detailed error handling
    console.log("=== REQUEST BODY PARSING ===");
    let body;
    try {
      const rawBody = await request.text();
      console.log("Raw request body:", rawBody);
      console.log("Raw body length:", rawBody.length);

      if (!rawBody) {
        console.error("Request body is empty");
        return Response.json(
          { error: "Request body is required", code: "EMPTY_BODY" },
          { status: 400 },
        );
      }

      body = JSON.parse(rawBody);
      console.log("✓ Request body parsed successfully:", body);
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError);
      console.error("Parse error message:", parseError.message);
      return Response.json(
        { error: "Invalid JSON in request body", code: "INVALID_JSON" },
        { status: 400 },
      );
    }

    const {
      target_type,
      target_value,
      include_web_scraping,
      include_nsfw,
      include_deep_image_scan,
      include_criminal,
      include_court,
      include_property,
      include_deep_scan,
      plate_region,
      include_license_plate,
      include_social_media,
      social_platforms,
      enable_real_time_monitoring,
    } = body || {};

    console.log("✓ Investigation request params extracted:", {
      target_type,
      target_value,
    });

    // Validation
    if (!target_type || !target_value) {
      console.log("Missing required fields:", { target_type, target_value });
      return Response.json(
        { error: "Missing required fields", code: "MISSING_FIELDS" },
        { status: 400 },
      );
    }

    // User credits check with detailed logging
    console.log("=== USER CREDITS CHECK ===");
    let userCheckResult;
    try {
      userCheckResult = await checkUserCredits(sql, userId);
      console.log("✓ User credits check completed:", userCheckResult);
    } catch (creditsError) {
      console.error("checkUserCredits failed:", creditsError);
      console.error("Credits error stack:", creditsError.stack);
      return Response.json(
        {
          error: "Failed to check user credentials",
          code: "USER_CHECK_FAILED",
        },
        { status: 500 },
      );
    }

    const { found, hasCredits, user, isAdmin } = userCheckResult;

    if (!found) {
      console.log("User not found in database:", userId);
      return Response.json(
        { error: "User not found", code: "USER_NOT_FOUND" },
        { status: 404 },
      );
    }

    const adminEmail = "glossontravis@gmail.com";
    const isAdminByEmail = (email || "").toLowerCase() === adminEmail;
    const admin = isAdmin || isAdminByEmail;

    console.log("✓ User permissions determined:", {
      isAdmin,
      admin,
      hasCredits,
      subscription_plan: user.subscription_plan,
    });

    // Trial restrictions check
    const isTrial =
      !admin && (!user.subscription_plan || user.subscription_plan === "trial");

    console.log("=== TRIAL RESTRICTIONS CHECK ===");
    console.log("Is trial user:", isTrial);

    if (isTrial) {
      try {
        const trialCheckQuery = `SELECT COUNT(*)::int as cnt FROM investigations WHERE user_id = ${userId}`;
        console.log("Executing trial check query:", trialCheckQuery);

        const [{ cnt }] = await sql`
          SELECT COUNT(*)::int as cnt FROM investigations WHERE user_id = ${userId}
        `;
        console.log("✓ Trial investigation count:", cnt);

        if (cnt >= 1) {
          console.log("Trial user exceeded limit:", {
            userId,
            currentCount: cnt,
          });
          return Response.json(
            {
              error: "Trial limit reached. Please upgrade to continue.",
              code: "TRIAL_EXCEEDED",
            },
            { status: 402 },
          );
        }
      } catch (trialError) {
        console.error("Trial check query failed:", trialError);
        console.error("Trial error stack:", trialError.stack);
        return Response.json(
          { error: "Failed to check trial status", code: "TRIAL_CHECK_FAILED" },
          { status: 500 },
        );
      }
    }

    // Credits check for non-admin, non-trial users
    if (!admin && !isTrial && !hasCredits) {
      console.log("User has no credits:", {
        userId,
        monthly_remaining: user.monthly_remaining,
      });
      return Response.json(
        { error: "No credits remaining", code: "INSUFFICIENT_CREDITS" },
        { status: 402 },
      );
    }

    // Investigation creation with detailed logging
    console.log("=== DATABASE INVESTIGATION CREATION ===");
    console.log("Calling createInvestigation with:", {
      userId,
      target_type,
      target_value,
    });

    let investigation;
    try {
      investigation = await createInvestigation(
        sql,
        userId,
        target_type,
        target_value,
      );
      console.log("✓ createInvestigation returned:", investigation);
      console.log("Investigation type:", typeof investigation);

      if (investigation) {
        console.log("Investigation keys:", Object.keys(investigation));
        console.log("Investigation values:", Object.values(investigation));
      }
    } catch (createError) {
      console.error("=== DATABASE CREATE FAILED ===");
      console.error("createInvestigation error:", createError);
      console.error("Create error message:", createError.message);
      console.error("Create error stack:", createError.stack);

      await logEvent(sql, "investigation_create_failed", "Create failed", {
        user_id: userId,
        target_type,
        target_value,
        error_message: createError.message,
        error_stack: createError.stack,
      });

      return Response.json(
        {
          error: "Failed to create investigation",
          code: "CREATE_FAILED",
          details: createError.message,
        },
        { status: 500 },
      );
    }

    // Investigation validation with detailed logging
    console.log("=== INVESTIGATION VALIDATION ===");

    if (!investigation) {
      console.error("❌ Investigation is null/undefined");
      console.error("createInvestigation returned:", investigation);
      await logEvent(
        sql,
        "investigation_create_failed",
        "Create returned null/undefined",
        {
          user_id: userId,
          target_type,
          target_value,
          investigation,
        },
      );
      return Response.json(
        {
          error: "Failed to create investigation - no data returned",
          code: "NO_DATA_RETURNED",
        },
        { status: 500 },
      );
    }

    console.log("✓ Investigation object exists");
    console.log("Investigation ID check - investigation.id:", investigation.id);
    console.log("Investigation ID type:", typeof investigation.id);

    if (!investigation.id) {
      console.error("❌ Investigation missing ID field");
      console.error("Investigation object keys:", Object.keys(investigation));
      console.error("Investigation object:", investigation);

      await logEvent(
        sql,
        "investigation_create_failed",
        "Create returned without id",
        {
          user_id: userId,
          target_type,
          target_value,
          investigation_object: investigation,
          investigation_keys: Object.keys(investigation),
        },
      );

      return Response.json(
        {
          error: "Failed to create investigation - no ID assigned",
          code: "NO_ID_RETURNED",
          details: "Database insert returned no ID",
        },
        { status: 500 },
      );
    }

    investigationId = investigation.id;
    console.log("✅ INVESTIGATION CREATED SUCCESSFULLY");
    console.log("Investigation ID:", investigationId);
    console.log("Investigation ID type:", typeof investigationId);

    // Processing flags normalization
    const processingFlags = isTrial
      ? {
          includeWebScraping: false,
          includeNSFW: false,
          includeDeepImageScan: false,
          includeDeepScan: false,
          includeCriminal: false,
          includeCourt: false,
          includeProperty: false,
          includeLicensePlate: false,
          licensePlateRegion: null,
          // Social media disabled for trial users
          includeSocialMedia: false,
          socialPlatforms: [],
          enableRealTimeMonitoring: false,
        }
      : {
          includeWebScraping: include_web_scraping !== false,
          includeNSFW: include_nsfw !== false,
          includeDeepImageScan: !!include_deep_image_scan,
          includeDeepScan: !!include_deep_scan,
          includeCriminal: include_criminal !== false,
          includeCourt: include_court !== false,
          includeProperty: include_property !== false,
          includeLicensePlate: include_license_plate !== false,
          licensePlateRegion: plate_region || null,
          // Social media options for paid users
          includeSocialMedia: include_social_media !== false,
          socialPlatforms: Array.isArray(social_platforms)
            ? social_platforms
            : ["twitter", "instagram", "linkedin", "facebook"],
          enableRealTimeMonitoring: !!enable_real_time_monitoring,
        };

    console.log("✓ Processing flags:", processingFlags);

    // NEW: persist flags on the investigation row so production can reliably start processing later
    try {
      await sql`
        UPDATE investigations
        SET processing_flags = ${JSON.stringify(processingFlags)}
        WHERE id = ${investigationId}
      `;
    } catch (e) {
      console.warn("Failed to persist processing_flags (non-fatal)", e);
    }

    // NEW: write an immediate progress event so the UI shows *something* even if processing starts later
    try {
      await insertProgressEvent(sql, investigationId, {
        stepKey: "queued",
        stepLabel: "Queued",
        eventStatus: "info",
        percent: 1,
        message: "Investigation created (starting soon)",
      });
    } catch (e) {
      // non-fatal
      console.warn("Failed to insert initial progress event", e);
    }

    // Session token creation with detailed logging
    console.log("=== SESSION TOKEN CREATION ===");
    const sessionToken = `inv_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    console.log("Generated session token:", sessionToken);

    try {
      await sql`
        INSERT INTO logs (log_type, message, metadata_json)
        VALUES ('investigation_session_token', 'Session token created', ${JSON.stringify(
          {
            session_token: sessionToken,
            investigation_id: investigation.id,
            user_id: userId,
            target_type,
            target_value,
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          },
        )})
      `;
      console.log("✓ Session token stored successfully");
    } catch (tokenError) {
      console.warn("Failed to create session token:", tokenError);
      console.warn("Token error stack:", tokenError.stack);
      // Non-fatal, continue without it
    }

    // Credit deduction for non-admin, non-trial
    if (!admin && !isTrial) {
      console.log("=== CREDIT DEDUCTION ===");
      try {
        await deductUserCredit(sql, userId);
        console.log("✓ Credit deducted for user:", userId);
      } catch (creditError) {
        console.error("Deduct credit failed:", creditError);
        console.error("Credit deduction stack:", creditError.stack);
        await logEvent(
          sql,
          "credit_deduction_failed",
          "Credit deduction failed",
          {
            user_id: userId,
            investigation_id: investigation.id,
            error_message: creditError.message,
            error_stack: creditError.stack,
          },
        );
        // Don't fail the entire request for credit deduction errors
      }
    }

    // Event logging
    try {
      await logEvent(
        sql,
        "investigation_created",
        "New investigation created",
        {
          investigation_id: investigation.id,
          user_id: userId,
          target_type,
          target_value,
          flags: processingFlags,
        },
      );
      console.log("✓ Investigation creation logged successfully");
    } catch (logError) {
      console.error("Failed to log investigation creation:", logError);
      // Non-fatal, continue
    }

    // REMOVE: unreliable background kickoff in production (serverless may freeze after response)
    // Processing will be started explicitly by the investigation detail page calling
    // POST /api/investigations/:id/start when it sees status=queued.

    // --- RESPONSE (simplified for reliability) ---
    // IMPORTANT: avoid complex Headers/Set-Cookie handling here. We only need to
    // return a stable JSON payload with the new investigation id so the client can redirect.
    const responseData = {
      id: investigation.id,
      investigation_id: investigation.id,
      ok: true,
      success: true,
      status: "created",
    };

    return Response.json(responseData, {
      status: 201,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "x-investigation-id": String(investigation.id),
        Location: `/investigations/${investigation.id}`,
      },
    });
  } catch (error) {
    console.error("=== INVESTIGATION API UNHANDLED ERROR ===");
    console.error("Unhandled error creating investigation:", error);
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);

    // Log the error with full context
    try {
      await logEvent(
        sql,
        "investigation_create_unhandled_error",
        "Unhandled error in create route",
        {
          error_message: error.message,
          error_stack: error.stack,
          error_name: error.name,
          investigation_id: investigationId,
          user_agent: request.headers.get("user-agent"),
          origin: request.headers.get("origin"),
        },
      );
    } catch (logError) {
      console.error("Failed to log error:", logError);
    }

    return Response.json(
      {
        error: "Failed to start investigation",
        code: "INTERNAL_ERROR",
        details: error.message || "Internal server error",
        debug: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
