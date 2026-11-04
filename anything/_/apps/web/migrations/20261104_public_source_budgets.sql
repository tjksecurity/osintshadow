-- REVIEW ONLY. Not applied by application startup or this task.
-- Independent of billing. One shared project budget per provider; no targets/keys.
BEGIN;
CREATE TABLE IF NOT EXISTS osint_provider_budgets (
  provider TEXT PRIMARY KEY CHECK (provider IN ('github','bluesky','stackexchange','openalex','wikidata','tavily','exa','veriphone')),
  day_key DATE NOT NULL,
  day_used INTEGER NOT NULL DEFAULT 0 CHECK (day_used >= 0),
  month_key DATE NOT NULL,
  month_used INTEGER NOT NULL DEFAULT 0 CHECK (month_used >= 0),
  last_request_at TIMESTAMPTZ,
  blocked_until TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS osint_provider_lookups (
  investigation_id BIGINT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL REFERENCES osint_provider_budgets(provider),
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ,
  result_json JSONB,
  PRIMARY KEY (investigation_id, provider),
  CHECK ((completed_at IS NULL) = (result_json IS NULL))
);
-- Verify investigations.id is integer-compatible and IDs are never reused
-- before applying. Deletion cascades retained results; aggregate budgets remain
-- consumed, never refunded by deleting/recreating an investigation.
COMMIT;
