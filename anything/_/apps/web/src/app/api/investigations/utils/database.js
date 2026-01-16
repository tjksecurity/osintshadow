export async function createInvestigation(
  sql,
  userId,
  targetType,
  targetValue,
) {
  console.log("Creating investigation:", { userId, targetType, targetValue });

  const investigation = await sql`
    INSERT INTO investigations (user_id, target_type, target_value, status)
    VALUES (${userId}, ${targetType}, ${targetValue}, 'queued')
    RETURNING *
  `;

  if (!Array.isArray(investigation) || investigation.length === 0) {
    throw new Error("Database INSERT failed - no rows returned");
  }

  if (!investigation[0]?.id) {
    throw new Error("Database INSERT failed - no ID returned");
  }

  console.log("Investigation created:", investigation[0].id);
  return investigation[0];
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
