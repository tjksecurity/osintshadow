// Durable request reservations, not a provider billing balance or usage estimate.
import { validInvestigationId } from '../../../../utils/publicSources.js';
export const PUBLIC_SOURCE_LIMITS = Object.freeze({
  github: { day: 50, month: 1000, interval: 75, units: 1 },
  bluesky: { day: 100, month: 2000, interval: 1, units: 1 },
  stackexchange: { day: 100, month: 2000, interval: 60, units: 1 },
  openalex: { day: 50, month: 1000, interval: 1, units: 1 },
  wikidata: { day: 100, month: 2000, interval: 2, units: 2 },
  tavily: { day: 30, month: 900, interval: 5, units: 1 },
  exa: { day: 30, month: 500, interval: 5, units: 1 },
  veriphone: { day: 30, month: 900, interval: 5, units: 1 },
});
async function bounded(work) {
  let timer;
  try { return await Promise.race([work(), new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('STORE_TIMEOUT')), 3000);
  })]); } finally { clearTimeout(timer); }
}

export function createPublicSourceStore(sql) {
  return {
    async reserve(provider, investigationId) {
      const limit = typeof provider === 'string' && Object.hasOwn(PUBLIC_SOURCE_LIMITS, provider) ? PUBLIC_SOURCE_LIMITS[provider] : null;
      if (!limit || !validInvestigationId(investigationId) || typeof sql?.transaction !== 'function') return { status: 'budget_unavailable' };
      try {
        const results = await bounded(() => sql.transaction(tx => [
          // Upsert locks this provider until commit. Next statement gets a fresh
          // READ COMMITTED snapshot after earlier reservations have committed.
          tx`INSERT INTO osint_provider_budgets (provider, day_key, month_key)
            VALUES (${provider}, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date,
              date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date)
            ON CONFLICT (provider) DO UPDATE SET provider = EXCLUDED.provider`,
          tx`WITH prior AS MATERIALIZED (
              SELECT result_json FROM osint_provider_lookups
              WHERE provider = ${provider} AND investigation_id = ${String(investigationId)}
            ), budget AS MATERIALIZED (
              SELECT *,
                CASE WHEN day_key = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date THEN day_used ELSE 0 END AS today,
                CASE WHEN month_key = date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date THEN month_used ELSE 0 END AS this_month
              FROM osint_provider_budgets WHERE provider = ${provider}
            ), claimed AS (
              INSERT INTO osint_provider_lookups (investigation_id, provider)
              SELECT ${String(investigationId)}, ${provider} FROM budget
              WHERE NOT EXISTS (SELECT 1 FROM prior)
                AND today + ${limit.units} <= ${limit.day} AND this_month + ${limit.units} <= ${limit.month}
                AND (blocked_until IS NULL OR blocked_until <= CURRENT_TIMESTAMP)
                AND (last_request_at IS NULL OR last_request_at <= CURRENT_TIMESTAMP - ${limit.interval} * INTERVAL '1 second')
              ON CONFLICT DO NOTHING RETURNING provider
            ), spent AS (
              UPDATE osint_provider_budgets b SET
                day_key = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date,
                month_key = date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date,
                day_used = budget.today + ${limit.units}, month_used = budget.this_month + ${limit.units},
                last_request_at = CURRENT_TIMESTAMP
              FROM budget, claimed WHERE b.provider = claimed.provider AND b.provider = budget.provider
              RETURNING b.provider
            )
            SELECT CASE
              WHEN EXISTS (SELECT 1 FROM prior WHERE result_json IS NOT NULL) THEN 'cached'
              WHEN EXISTS (SELECT 1 FROM prior) THEN 'lookup_pending'
              WHEN EXISTS (SELECT 1 FROM spent) THEN 'reserved'
              WHEN EXISTS (SELECT 1 FROM budget WHERE today + ${limit.units} > ${limit.day} OR this_month + ${limit.units} > ${limit.month}) THEN 'quota_exhausted'
              ELSE 'rate_limited' END AS status,
              (SELECT result_json FROM prior) AS envelope`,
        ], { isolationLevel: 'ReadCommitted' }));
        return results?.[1]?.[0] ?? { status: 'budget_unavailable' };
      } catch { return { status: 'budget_unavailable' }; }
    },
    async save(provider, investigationId, envelope, cooldownSeconds = 0) {
      if (typeof provider !== 'string' || !Object.hasOwn(PUBLIC_SOURCE_LIMITS, provider) || !validInvestigationId(investigationId) || typeof sql?.transaction !== 'function') return false;
      const seconds = Number.isFinite(cooldownSeconds) ? Math.min(2678400, Math.max(0, Math.ceil(cooldownSeconds))) : 0;
      try {
        const results = await bounded(() => sql.transaction(tx => [
          // Same lock ordering as reserve avoids deadlock; cooldown and receipt
          // must commit together. Saving is allowed once, never overwrites results.
          tx`UPDATE osint_provider_budgets SET blocked_until = CASE WHEN ${seconds} > 0
            THEN GREATEST(COALESCE(blocked_until, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP + ${seconds} * INTERVAL '1 second')
            ELSE blocked_until END WHERE provider = ${provider} RETURNING provider`,
          tx`UPDATE osint_provider_lookups SET result_json = ${JSON.stringify(envelope)}::jsonb, completed_at = CURRENT_TIMESTAMP
            WHERE provider = ${provider} AND investigation_id = ${String(investigationId)} AND result_json IS NULL RETURNING provider`,
        ], { isolationLevel: 'ReadCommitted' }));
        return results?.[0]?.length === 1 && results?.[1]?.length === 1;
      } catch { return false; }
    },
  };
}
