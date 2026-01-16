import { useState } from "react";

export function useNewInvestigation() {
  const [targetType, setTargetType] = useState("email");
  const [targetValue, setTargetValue] = useState("");
  const [includeWebScraping, setIncludeWebScraping] = useState(true);
  const [includeNSFW, setIncludeNSFW] = useState(true);
  const [includeDeepImageScan, setIncludeDeepImageScan] = useState(false);
  const [includeDeepScan, setIncludeDeepScan] = useState(false);
  const [includeCriminal, setIncludeCriminal] = useState(true);
  const [includeCourt, setIncludeCourt] = useState(true);
  const [includeProperty, setIncludeProperty] = useState(true);
  const [includeLicensePlate, setIncludeLicensePlate] = useState(true);
  const [plateRegion, setPlateRegion] = useState("CA");

  // Social Media State Variables
  const [includeSocialMedia, setIncludeSocialMedia] = useState(true);
  const [socialPlatforms, setSocialPlatforms] = useState([
    "twitter",
    "instagram",
    "linkedin",
    "facebook",
  ]);
  const [enableRealTimeMonitoring, setEnableRealTimeMonitoring] =
    useState(false);

  // NEW: Social Media Post Collection
  const [includePostCollection, setIncludePostCollection] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState(null);
  const [showPaywall, setShowPaywall] = useState(false);

  const handleSubmit = async (e) => {
    try {
      if (e && typeof e.preventDefault === "function") {
        e.preventDefault();
      }

      console.log("=== FRONTEND INVESTIGATION CREATION START ===");
      setSubmitting(true);
      setError("");
      setErrorCode(null);
      setShowPaywall(false);

      console.log("Starting investigation creation...");

      const requestBody = {
        target_type: targetType,
        target_value: targetValue.trim(),
        include_web_scraping: includeWebScraping,
        include_nsfw: includeNSFW,
        include_deep_image_scan: includeDeepImageScan,
        include_deep_scan: includeDeepScan,
        include_criminal: includeCriminal,
        include_court: includeCourt,
        include_property: includeProperty,
        include_license_plate: includeLicensePlate,
        plate_region: targetType === "license_plate" ? plateRegion : null,

        // Social Media Options
        include_social_media: includeSocialMedia,
        social_platforms: includeSocialMedia ? socialPlatforms : [],
        enable_real_time_monitoring: enableRealTimeMonitoring,

        // Social Media Post Collection
        include_post_collection: includePostCollection,
      };

      console.log("✓ Request body prepared:", requestBody);

      // Make the request with detailed logging
      console.log("=== MAKING FETCH REQUEST ===");
      let response;
      try {
        response = await fetch("/api/investigations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          credentials: "include",
          body: JSON.stringify(requestBody),
        });
        console.log("✓ Fetch request completed");
      } catch (fetchError) {
        console.error("❌ Fetch request failed:", fetchError);
        throw new Error(`Network error: ${fetchError.message}`);
      }

      console.log("=== RESPONSE ANALYSIS ===");
      console.log("Response status:", response.status);
      console.log("Response ok:", response.ok);
      console.log("Response redirected:", response.redirected);
      console.log("Response URL:", response.url);

      const responseHeaders = Object.fromEntries(response.headers.entries());
      console.log("Response headers:", responseHeaders);

      // Handle auth redirects with detailed logging
      if (response.redirected && response.url.includes("signin")) {
        console.log("❌ AUTH REDIRECT: Redirecting to signin");
        window.location.href = `/account/signin?callbackUrl=${encodeURIComponent(window.location.pathname)}`;
        return;
      }

      // Read response as text first
      console.log("=== READING RESPONSE BODY ===");
      let responseText;
      try {
        responseText = await response.text();
        console.log("✓ Response text read successfully");
        console.log("Raw response text:", responseText);
        console.log("Raw response length:", responseText.length);
      } catch (textError) {
        console.error("❌ Failed to read response text:", textError);
        throw new Error(`Failed to read response: ${textError.message}`);
      }

      // Check for HTML response (auth page)
      if (responseText.startsWith("<")) {
        console.warn("❌ GOT HTML: Auth redirect detected");
        window.location.href = `/account/signin?callbackUrl=${encodeURIComponent(window.location.pathname)}`;
        return;
      }

      // Handle error responses with detailed logging
      if (!response.ok) {
        console.log("❌ RESPONSE NOT OK:", response.status);

        let errorData;
        try {
          errorData = responseText ? JSON.parse(responseText) : null;
          console.log("Error response parsed:", errorData);
        } catch (parseError) {
          console.error("Failed to parse error response JSON:", parseError);
          errorData = {
            error: `HTTP ${response.status}: ${responseText.slice(0, 200)}`,
            details: responseText,
          };
        }

        // Handle specific error codes
        if (errorData?.code === "UNAUTHORIZED") {
          console.log("❌ UNAUTHORIZED: Redirecting to signin");
          window.location.href = `/account/signin?callbackUrl=${encodeURIComponent(window.location.pathname)}`;
          return;
        }

        if (
          errorData?.code === "TRIAL_EXCEEDED" ||
          errorData?.code === "INSUFFICIENT_CREDITS"
        ) {
          console.log("❌ CREDITS/TRIAL: Showing paywall");
          setShowPaywall(true);
          setSubmitting(false);
          return;
        }

        setErrorCode(errorData?.code || null);
        throw new Error(
          (errorData && errorData.error) ||
            `Request failed with status ${response.status}`,
        );
      }

      console.log("✅ RESPONSE OK: Processing successful response");

      // Try parsing as JSON
      let data = null;
      try {
        if (responseText && responseText !== "null") {
          data = JSON.parse(responseText);
        }
      } catch (e) {
        console.warn("Response not valid JSON:", responseText);
      }

      // Multi-method ID extraction
      let investigationId = null;

      // Method 1: From response body
      if (data?.id || data?.investigation_id) {
        investigationId = data.id || data.investigation_id;
        console.log("✅ ID from response body:", investigationId);
      }

      // Method 2: From x-investigation-id header
      if (!investigationId) {
        investigationId = response.headers.get("x-investigation-id");
        if (investigationId) console.log("✅ ID from header:", investigationId);
      }

      // Method 3: From Location header
      if (!investigationId) {
        const location = response.headers.get("location");
        const match = location?.match(/\/investigations\/(\d+)/);
        if (match) {
          investigationId = match[1];
          console.log("✅ ID from location:", investigationId);
        }
      }

      // Method 4: From session token
      if (!investigationId) {
        const sessionToken = response.headers.get("x-session-token");
        if (sessionToken) {
          try {
            const tokenResp = await fetch(
              `/api/investigations/session?token=${sessionToken}`,
            );
            if (tokenResp.ok) {
              const tokenData = await tokenResp.json();
              investigationId = tokenData.investigation_id;
              if (investigationId)
                console.log("✅ ID from session token:", investigationId);
            }
          } catch (e) {
            console.warn("Session token lookup failed:", e);
          }
        }
      }

      // Method 5: From cookies
      if (!investigationId && typeof document !== "undefined") {
        const cookieMatch = document.cookie.match(/investigation_id=([^;]+)/);
        if (cookieMatch) {
          investigationId = decodeURIComponent(cookieMatch[1]);
          console.log("✅ ID from cookie:", investigationId);
        }
      }

      // Method 6: Final fallback - get latest investigation
      if (!investigationId) {
        try {
          const latestResp = await fetch("/api/investigations?limit=1", {
            credentials: "include",
          });
          if (latestResp.ok) {
            const latestData = await latestResp.json();
            investigationId = latestData.investigations?.[0]?.id;
            if (investigationId)
              console.log("✅ ID from latest fallback:", investigationId);
          }
        } catch (e) {
          console.warn("Latest investigation lookup failed:", e);
        }
      }

      // Final validation
      if (!investigationId) {
        throw new Error(
          `No investigation ID found. Status: ${response.status}, Body: "${responseText.slice(0, 100)}", Debug: ${Date.now()}`,
        );
      }

      // Success - redirect
      console.log("✅ ✅ ✅ INVESTIGATION ID EXTRACTED SUCCESSFULLY ✅ ✅ ✅");
      console.log("Investigation ID:", investigationId);
      console.log("About to redirect to /investigations/" + investigationId);
      window.location.href = `/investigations/${investigationId}`;
    } catch (err) {
      console.error("=== FRONTEND INVESTIGATION CREATION FAILED ===");
      console.error("Error object:", err);
      console.error("Error name:", err?.name);
      console.error("Error message:", err?.message);
      console.error("Error stack:", err?.stack);

      // Set user-friendly error message
      setError(
        err.message || "Failed to create investigation. Please try again.",
      );
    } finally {
      console.log("=== FRONTEND INVESTIGATION CREATION END ===");
      setSubmitting(false);
    }
  };

  return {
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

    // Social Media States
    includeSocialMedia,
    setIncludeSocialMedia,
    socialPlatforms,
    setSocialPlatforms,
    enableRealTimeMonitoring,
    setEnableRealTimeMonitoring,

    // Social Media Post Collection
    includePostCollection,
    setIncludePostCollection,

    submitting,
    error,
    errorCode,
    showPaywall,
    setShowPaywall,
    handleSubmit,
  };
}
