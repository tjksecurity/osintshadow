import { readStoredProcessingFlags } from './processingFlags.js';

export async function regenerateInvestigation(sql, investigation, userId) {
  const flags = readStoredProcessingFlags(investigation.processing_flags);
  if (!flags) return { code: 'PROCESSING_FLAGS_REQUIRED' };
  if (!['completed', 'failed'].includes(investigation.status)) {
    return { code: 'INVESTIGATION_RUNNING' };
  }
  if (typeof sql.transaction !== 'function') {
    throw new Error('Regeneration requires transactional persistence.');
  }
  const id = investigation.id;
  const [, rows] = await sql.transaction((tx) => [
    tx`SELECT id FROM investigations WHERE id = ${id} AND user_id = ${userId} FOR UPDATE`,
    tx`
      WITH eligible AS MATERIALIZED (
        SELECT id FROM investigations
        WHERE id = ${id} AND user_id = ${userId}
          AND status IN ('completed', 'failed')
          AND processing_flags::jsonb = ${JSON.stringify(flags)}::jsonb
          AND processing_lock_token IS NULL
          AND (processing_locked_until IS NULL OR processing_locked_until < NOW())
      ), deleted_ai AS (
        DELETE FROM ai_output WHERE investigation_id IN (SELECT id FROM eligible) RETURNING 1
      ), deleted_osint AS (
        DELETE FROM osint_raw WHERE investigation_id IN (SELECT id FROM eligible) RETURNING 1
      ), deleted_geo AS (
        DELETE FROM geo_markers WHERE investigation_id IN (SELECT id FROM eligible) RETURNING 1
      ), deleted_reports AS (
        DELETE FROM reports WHERE investigation_id IN (SELECT id FROM eligible) RETURNING 1
      ), deleted_progress AS (
        DELETE FROM investigation_progress_events WHERE investigation_id IN (SELECT id FROM eligible) RETURNING 1
      ), deleted_posts AS (
        DELETE FROM social_posts WHERE profile_id IN (
          SELECT id FROM social_profiles WHERE investigation_id IN (SELECT id FROM eligible)
        ) RETURNING 1
      ), deleted_monitoring AS (
        DELETE FROM social_monitoring WHERE investigation_id IN (SELECT id FROM eligible) RETURNING 1
      ), deleted_profiles AS (
        DELETE FROM social_profiles WHERE investigation_id IN (SELECT id FROM eligible)
          AND (SELECT COUNT(*) FROM deleted_posts) >= 0
          AND (SELECT COUNT(*) FROM deleted_monitoring) >= 0
        RETURNING 1
      ), reset AS (
        UPDATE investigations SET status = 'queued', completed_at = NULL
        WHERE id IN (SELECT id FROM eligible)
          AND (SELECT COUNT(*) FROM deleted_ai) >= 0
          AND (SELECT COUNT(*) FROM deleted_osint) >= 0
          AND (SELECT COUNT(*) FROM deleted_geo) >= 0
          AND (SELECT COUNT(*) FROM deleted_reports) >= 0
          AND (SELECT COUNT(*) FROM deleted_progress) >= 0
          AND (SELECT COUNT(*) FROM deleted_profiles) >= 0
        RETURNING id
      )
      INSERT INTO investigation_progress_events
        (investigation_id, step_key, step_label, event_status, percent, message)
      SELECT id, 'queued', 'Queued', 'info', 1, 'Regeneration queued' FROM reset
      RETURNING investigation_id
    `,
  ], { isolationLevel: 'ReadCommitted' });
  return rows?.length ? { id } : { code: 'PROCESSING_STATE_CHANGED' };
}
