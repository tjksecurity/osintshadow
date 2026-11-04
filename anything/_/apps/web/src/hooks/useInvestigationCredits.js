import { useQuery } from '@tanstack/react-query';
import { useSession } from '@auth/create/react';

export function useInvestigationCredits(userId) {
  // useUser may temporarily retain the previous profile while a session changes.
  // Key and gate the credit view using the current authenticated session too.
  const { data: session, status } = useSession();
  const currentId = session?.user?.id;
  const sameAccount = status === 'authenticated' && !!currentId && String(currentId) === String(userId);
  const query = useQuery({
    queryKey: ['investigationCredits', currentId ?? null],
    enabled: sameAccount,
    queryFn: async ({ signal }) => {
      if (!sameAccount) throw new Error('Account session changed; refresh the page');
      const response = await fetch('/api/user/credits', {
        credentials: 'include', cache: 'no-store', signal,
      });
      if (!response.ok) throw new Error('Could not load current credits');
      const credits = await response.json();
      if (credits?.user_id !== String(currentId)) throw new Error('Account session changed; refresh the page');
      if (typeof credits.credits_unlimited !== 'boolean' ||
          typeof credits.is_trial !== 'boolean' ||
          typeof credits.monthly_remaining !== 'number' ||
          !Number.isFinite(credits.monthly_remaining)) {
        throw new Error('Could not verify current credits');
      }
      return credits;
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  return sameAccount ? query : { ...query, data: undefined, error: null };
}
