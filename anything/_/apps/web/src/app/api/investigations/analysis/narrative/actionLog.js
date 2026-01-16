export function buildActionLog(
  osintData,
  breachCount,
  handles,
  existingProfiles,
  identityGraph,
  locationCoherence,
) {
  const actionLog = [];

  actionLog.push(
    `Initiated investigation for target: ${osintData.target_value} (${osintData.target_type})`,
  );

  if (breachCount > 0) {
    actionLog.push(
      `Detected ${breachCount} data breaches (HIBP/Open Web); analyzing exposure timeline.`,
    );
  } else {
    actionLog.push("Checked breach databases; no direct hits found.");
  }

  if (handles.length > 0) {
    actionLog.push(
      `Discovered ${handles.length} unique usernames/handles associated with target.`,
    );
  }

  if (existingProfiles.length > 0) {
    actionLog.push(
      `Identified ${existingProfiles.length} social media profiles across multiple platforms.`,
    );
    const nsfw = existingProfiles.filter((p) =>
      ["adult", "fetish"].includes(p.platform_category),
    );
    if (nsfw.length) {
      actionLog.push(
        `Flagged ${nsfw.length} profiles for high-risk content categories.`,
      );
    }
  }

  if (identityGraph.phones.length > 0) {
    actionLog.push(
      `Uncovered ${identityGraph.phones.length} associated phone numbers.`,
    );
  }

  if (locationCoherence.issues.length > 0) {
    actionLog.push(
      "Detected location inconsistencies across digital footprint.",
    );
  }

  actionLog.push("Synthesizing identity graph and calculating risk score.");

  return actionLog;
}
