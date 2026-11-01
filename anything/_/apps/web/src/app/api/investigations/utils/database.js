import { normalizeProcessingFlags } from './processingFlags.js';

export async function createInvestigation(
  sql,
  userId,
  targetType,
  targetValue,
  options = {},
) {
  if (typeof sql.transaction !== 'function') {
    throw new Error('Investigation creation requires transactional persistence.');
  }

  // Hold the account lock until both the debit and insert commit. A fresh
  // ReadCommitted snapshot for statement two observes earlier requests' trial
  // investigations as well as paid credit debits after waiting for this lock.
  const [locked, results] = await sql.transaction((transaction) => [
    transaction`SELECT id FROM auth_users WHERE id = ${userId} FOR UPDATE`,
    transaction`
      WITH account AS MATERIALIZED (
        SELECT id, monthly_remaining,
          (COALESCE(role, '') = 'admin' OR LOWER(COALESCE(email, '')) = ${'glossontravis@gmail.com'}) AS is_admin,
          (COALESCE(subscription_plan, '') IN ('', 'trial')) AS is_trial
        FROM auth_users WHERE id = ${userId}
      ), eligible AS MATERIALIZED (
        SELECT * FROM account
        WHERE is_admin
          OR (is_trial AND NOT EXISTS (
            SELECT 1 FROM investigations WHERE user_id = account.id
          ))
          OR (NOT is_trial AND monthly_remaining > 0)
      ), debited AS (
        UPDATE auth_users AS users
        SET monthly_remaining = users.monthly_remaining - 1
        FROM eligible
        WHERE users.id = eligible.id AND NOT eligible.is_admin AND NOT eligible.is_trial
        RETURNING users.id
      ), created AS (
        INSERT INTO investigations (user_id, target_type, target_value, status, processing_flags)
        SELECT id, ${targetType}, ${targetValue}, 'queued',
          (jsonb_populate_record(NULL::investigations,
            jsonb_build_object('processing_flags', CASE WHEN is_trial AND NOT is_admin
              THEN ${JSON.stringify(normalizeProcessingFlags({}, true))}::jsonb
              ELSE ${JSON.stringify(normalizeProcessingFlags(options, false))}::jsonb END)
          )).processing_flags
        FROM eligible
        WHERE is_admin OR is_trial OR EXISTS (SELECT 1 FROM debited)
        RETURNING *
      )
      SELECT row_to_json(created) AS investigation,
        (SELECT is_admin FROM account) AS is_admin,
        (SELECT is_trial AND NOT is_admin FROM account) AS is_trial,
        CASE WHEN NOT EXISTS (SELECT 1 FROM account) THEN 'USER_NOT_FOUND'
          WHEN NOT EXISTS (SELECT 1 FROM eligible) THEN
            CASE WHEN (SELECT is_trial FROM account) THEN 'TRIAL_EXCEEDED'
              ELSE 'INSUFFICIENT_CREDITS' END
          ELSE NULL END AS rejection
      FROM (SELECT 1) AS result LEFT JOIN created ON TRUE
    `,
  ], { isolationLevel: 'ReadCommitted' });

  const result = results?.[0];
  const rejection = !locked?.length ? 'USER_NOT_FOUND' : result?.rejection;
  if (rejection) {
    const error = new Error('Investigation authorization changed before creation.');
    error.code = rejection;
    throw error;
  }
  if (!result?.investigation?.id) {
    throw new Error("Database INSERT failed - no ID returned");
  }

  return {
    ...result.investigation,
    __creditAuthorization: { isAdmin: Boolean(result.is_admin), isTrial: Boolean(result.is_trial) },
  };
}

export async function updateInvestigationStatus(
  sql,
  investigationId,
  status,
  completed = false,
) {
  if (completed) {
    await sql`
      UPDATE investigations 
      SET status = ${status}, completed_at = NOW() 
      WHERE id = ${investigationId}
    `;
  } else {
    await sql`
      UPDATE investigations 
      SET status = ${status} 
      WHERE id = ${investigationId}
    `;
  }
}

export async function insertOSINTData(sql, investigationId, osintData) {
  await sql`
    INSERT INTO osint_raw (investigation_id, data_json)
    VALUES (${investigationId}, ${JSON.stringify(osintData)})
  `;
}

export async function insertAIAnalysis(sql, investigationId, aiAnalysis) {
  await sql`
    INSERT INTO ai_output (investigation_id, summary, anomalies, risk_score, full_json)
    VALUES (${investigationId}, ${aiAnalysis.summary}, ${aiAnalysis.anomalies}, ${aiAnalysis.risk_score}, ${JSON.stringify(aiAnalysis)})
  `;
}

export async function insertGeoMarkers(
  sql,
  investigationId,
  markers,
  riskLevel,
) {
  for (const m of markers) {
    await sql`
      INSERT INTO geo_markers (investigation_id, lat, lng, label, risk_level)
      VALUES (${investigationId}, ${m.lat}, ${m.lng}, ${m.label}, ${riskLevel})
    `;
  }
}

export async function insertReport(sql, investigationId, reportHtml) {
  await sql`
    INSERT INTO reports (investigation_id, html_content)
    VALUES (${investigationId}, ${reportHtml})
  `;
}

export async function logEvent(sql, logType, message, metadata) {
  await sql`
    INSERT INTO logs (log_type, message, metadata_json)
    VALUES (${logType}, ${message}, ${JSON.stringify(metadata)})
  `;
}

// NEW: persist investigation progress events so the UI can show live progress
export async function insertProgressEvent(
  sql,
  investigationId,
  { stepKey, stepLabel, eventStatus = "info", percent = null, message = null },
) {
  await sql`
    INSERT INTO investigation_progress_events (
      investigation_id,
      step_key,
      step_label,
      event_status,
      percent,
      message
    ) VALUES (
      ${investigationId},
      ${stepKey},
      ${stepLabel},
      ${eventStatus},
      ${percent},
      ${message}
    )
  `;
}
