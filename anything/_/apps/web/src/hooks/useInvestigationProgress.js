import { useQuery } from "@tanstack/react-query";

export function useInvestigationProgress(id, investigationStatus) {
  const shouldPoll =
    investigationStatus === "queued" || investigationStatus === "processing";

  const query = useQuery({
    // Include status so changing queued->processing forces a fresh fetch and avoids any weird reuse.
    queryKey: ["investigationProgress", id, investigationStatus],
    enabled: !!id,
    queryFn: async () => {
      // Cache-bust the URL as a last line of defense against any CDN/proxy caching.
      const url = `/api/investigations/${id}/progress?t=${Date.now()}`;
      const res = await fetch(url, {
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-store",
        },
      });

      if (!res.ok) {
        let payload = null;
        try {
          payload = await res.json();
        } catch (_) {}
        const code = payload?.code || res.status;
        const msg = payload?.error || `Request failed (${res.status})`;
        throw new Error(
          `Live progress failed: ${msg}${code ? ` [${code}]` : ""}`,
        );
      }

      const json = await res.json();

      // IMPORTANT: always include a client-side timestamp so the UI can prove polling is happening
      // even if an upstream cache ever serves a repeated payload.
      return {
        ...json,
        _clientFetchedAt: new Date().toISOString(),
      };
    },

    // Poll more frequently while running so the UI feels "live".
    // (Server is also told to never cache these responses.)
    refetchInterval: shouldPoll ? 1000 : false,
    refetchIntervalInBackground: true,

    // Ensure each poll is treated as fresh.
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,

    retry: 1,
  });

  return query;
}
