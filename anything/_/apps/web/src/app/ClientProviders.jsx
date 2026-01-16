"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export default function ClientProviders({ children }) {
  // Ensure a single QueryClient instance per app lifecycle
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5,
            // Keep cacheTime for compatibility across versions
            cacheTime: 1000 * 60 * 30,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  // NEW: Enforce canonical host to ensure auth cookies are sent in prod
  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = window.location.hostname;
    // Canonical domain for this app (from publishing docs): www.osintshadow.com
    const canonicalHost = "www.osintshadow.com";

    // If we're on a different subdomain of osintshadow.com, normalize to www.
    const isOsintshadowDomain =
      host === "osintshadow.com" || host.endsWith(".osintshadow.com");
    const onCanonical = host === canonicalHost;

    if (isOsintshadowDomain && !onCanonical) {
      const newUrl = `${window.location.protocol}//${canonicalHost}${window.location.pathname}${window.location.search}${window.location.hash}`;
      try {
        window.location.replace(newUrl);
      } catch {
        window.location.href = newUrl;
      }
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
