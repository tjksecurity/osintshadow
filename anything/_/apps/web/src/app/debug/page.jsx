"use client";

import { useState } from "react";
import useUser from "@/utils/useUser";

export default function DebugPage() {
  const { data: user, loading } = useUser();
  const [debugInfo, setDebugInfo] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const testInvestigationCreation = async () => {
    setIsLoading(true);
    setError(null);
    setDebugInfo(null);

    try {
      console.log("Starting debug investigation test...");

      const testPayload = {
        target_type: "email",
        target_value: "debug.test@example.com",
        include_web_scraping: true,
        include_nsfw: true,
      };

      console.log("Test payload:", testPayload);

      const response = await fetch("/api/investigations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
        credentials: "include",
        body: JSON.stringify(testPayload),
      });

      console.log("Response received:", response);
      console.log("Response status:", response.status);
      console.log(
        "Response headers:",
        Object.fromEntries(response.headers.entries()),
      );

      const responseText = await response.text();
      console.log("Response text:", responseText);

      let responseData = null;
      try {
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        console.error("Failed to parse response as JSON:", parseError);
      }

      const debug = {
        timestamp: new Date().toISOString(),
        request: {
          url: "/api/investigations",
          method: "POST",
          payload: testPayload,
        },
        response: {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          rawText: responseText,
          parsedData: responseData,
        },
        extraction: {
          idFromData:
            responseData?.id || responseData?.investigation_id || null,
          idFromHeader: response.headers.get("x-investigation-id"),
          locationHeader: response.headers.get("location"),
          cookiesSet: response.headers.get("set-cookie"),
        },
        environment: {
          userAgent: navigator.userAgent,
          origin: window.location.origin,
          protocol: window.location.protocol,
          hostname: window.location.hostname,
        },
      };

      console.log("Debug info compiled:", debug);
      setDebugInfo(debug);
    } catch (err) {
      console.error("Debug test failed:", err);
      setError({
        message: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading user info...</div>;
  }

  if (!user) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Debug - Not Authenticated</h1>
        <p>Please sign in to use the debug tool.</p>
        <a href="/account/signin" className="text-blue-600 hover:underline">
          Sign In
        </a>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">
        Investigation Creation Debug Tool
      </h1>

      <div className="mb-6 p-4 bg-gray-100 rounded">
        <h2 className="text-xl font-semibold mb-2">Current User</h2>
        <div className="font-mono text-sm">
          <div>ID: {user.id}</div>
          <div>Email: {user.email}</div>
          <div>Name: {user.name}</div>
        </div>
      </div>

      <button
        onClick={testInvestigationCreation}
        disabled={isLoading}
        className="mb-6 px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {isLoading ? "Testing..." : "Test Investigation Creation"}
      </button>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 rounded">
          <h3 className="text-lg font-semibold text-red-800 mb-2">Error</h3>
          <div className="font-mono text-sm text-red-700">
            <div>Message: {error.message}</div>
            <div>Time: {error.timestamp}</div>
            {error.stack && (
              <details className="mt-2">
                <summary className="cursor-pointer">Stack Trace</summary>
                <pre className="mt-1 whitespace-pre-wrap text-xs">
                  {error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      )}

      {debugInfo && (
        <div className="space-y-6">
          <div className="p-4 bg-green-100 border border-green-400 rounded">
            <h3 className="text-lg font-semibold text-green-800 mb-2">
              Debug Results
            </h3>
            <div className="text-sm text-green-700">
              Test completed at {debugInfo.timestamp}
            </div>
          </div>

          <div className="p-4 bg-gray-50 border rounded">
            <h3 className="text-lg font-semibold mb-2">Request Details</h3>
            <pre className="text-sm font-mono bg-white p-3 rounded border overflow-auto">
              {JSON.stringify(debugInfo.request, null, 2)}
            </pre>
          </div>

          <div className="p-4 bg-gray-50 border rounded">
            <h3 className="text-lg font-semibold mb-2">Response Details</h3>
            <pre className="text-sm font-mono bg-white p-3 rounded border overflow-auto max-h-96">
              {JSON.stringify(debugInfo.response, null, 2)}
            </pre>
          </div>

          <div className="p-4 bg-blue-50 border rounded">
            <h3 className="text-lg font-semibold mb-2">
              ID Extraction Analysis
            </h3>
            <pre className="text-sm font-mono bg-white p-3 rounded border overflow-auto">
              {JSON.stringify(debugInfo.extraction, null, 2)}
            </pre>
            {debugInfo.extraction.idFromData && (
              <div className="mt-3 p-2 bg-green-100 rounded">
                <strong>✅ ID Found in Response Data:</strong>{" "}
                {debugInfo.extraction.idFromData}
              </div>
            )}
            {debugInfo.extraction.idFromHeader && (
              <div className="mt-3 p-2 bg-green-100 rounded">
                <strong>✅ ID Found in Header:</strong>{" "}
                {debugInfo.extraction.idFromHeader}
              </div>
            )}
            {debugInfo.extraction.locationHeader && (
              <div className="mt-3 p-2 bg-green-100 rounded">
                <strong>✅ Location Header:</strong>{" "}
                {debugInfo.extraction.locationHeader}
              </div>
            )}
            {!debugInfo.extraction.idFromData &&
              !debugInfo.extraction.idFromHeader &&
              !debugInfo.extraction.locationHeader && (
                <div className="mt-3 p-2 bg-red-100 rounded">
                  <strong>❌ No ID found in any expected location!</strong>
                </div>
              )}
          </div>

          <div className="p-4 bg-gray-50 border rounded">
            <h3 className="text-lg font-semibold mb-2">Environment Info</h3>
            <pre className="text-sm font-mono bg-white p-3 rounded border overflow-auto">
              {JSON.stringify(debugInfo.environment, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
