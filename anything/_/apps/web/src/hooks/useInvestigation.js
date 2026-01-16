import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useInvestigation(id) {
  const queryClient = useQueryClient();

  const {
    data: investigation,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["investigation", id],
    queryFn: async () => {
      const res = await fetch(`/api/investigations/${id}`);
      if (!res.ok) {
        throw new Error(
          `When fetching /api/investigations/${id}, the response was [${res.status}] ${res.statusText}`,
        );
      }
      return res.json();
    },
    enabled: !!id,

    // Keep the page status badge in sync while an investigation is running.
    refetchInterval: (query) => {
      const status = query?.state?.data?.status;
      return status === "queued" || status === "processing" ? 4000 : false;
    },
    refetchIntervalInBackground: true,
  });

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/investigations/${id}`, { method: "POST" });
      if (!res.ok) {
        throw new Error(
          `When posting /api/investigations/${id}, the response was [${res.status}] ${res.statusText}`,
        );
      }
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["investigation", id] });
    },
    onError: (e) => {
      console.error(e);
    },
  });

  return {
    investigation,
    isLoading,
    error,
    refetch,
    regenerate: regenerateMutation.mutate,
    isRegenerating: regenerateMutation.isLoading,
  };
}
