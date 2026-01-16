import {
  extractOsintModules,
  extractBaseIdentifiers,
} from "./utils/dataExtractors.js";
import { normalizeProfiles } from "./profiles/profileNormalizer.js";
import { buildIdentityGraph } from "./identity/identityGraph.js";
import { analyzeBreachExposure } from "./breach/breachAnalyzer.js";
import { analyzeLocationCoherence } from "./location/locationAnalyzer.js";
import { analyzeSocialFootprint } from "./social/socialFootprint.js";
import { buildTechnicalProfile } from "./technical/technicalProfile.js";
import { buildCryptoProfile } from "./crypto/cryptoProfile.js";
import { calculateRiskScore } from "./risk/riskCalculator.js";
import { buildActionLog } from "./narrative/actionLog.js";
import { buildPresentation } from "./narrative/presentation.js";
import { extractConfirmedData } from "./confirmed/confirmedData.js";
import { detectAssociates } from "./associates/associateDetector.js";
import { buildTimeline } from "./timeline/timelineBuilder.js";
import { enhanceWithAI } from "./llm/anthropicEnhancer.js";

export async function performAIAnalysis(osintData, options = {}) {
  const onProgress =
    typeof options?.onProgress === "function" ? options.onProgress : null;

  const progress = (message, percent) => {
    try {
      if (!onProgress) return;
      onProgress({ message, percent });
    } catch (_) {
      // don't let progress reporting break analysis
    }
  };

  progress("Parsing OSINT modules", 66);

  // Extract OSINT modules
  const {
    emailInfo,
    usernameInfo,
    phoneInfo,
    domainInfo,
    ipNetInfo,
    socialInfo,
    imagesInfo,
    cryptoInfo,
    breachesInfo,
    mentionsInfo,
    deepInfo,
    recordsInfo,
  } = extractOsintModules(osintData);

  progress("Extracting core identifiers", 67);

  // Extract base identifiers
  const { baseEmail, emailLocal, emailDomain, phoneSeeds } =
    extractBaseIdentifiers(osintData, emailInfo, phoneInfo);

  progress("Normalizing profiles", 68);

  // Normalize profiles
  const existingProfiles = normalizeProfiles(usernameInfo, emailLocal);

  progress("Building identity graph", 69);

  // Build identity graph
  const identityGraph = buildIdentityGraph(
    osintData,
    baseEmail,
    emailLocal,
    emailDomain,
    phoneSeeds,
    emailInfo,
    usernameInfo,
    domainInfo,
    ipNetInfo,
    deepInfo,
    existingProfiles,
  );

  progress("Analyzing breach exposure", 70);

  // Analyze breach exposure
  const breachExposure = analyzeBreachExposure(emailInfo, breachesInfo);

  progress("Detecting associates", 71);

  // Detect associates
  const associates = await detectAssociates(osintData);

  progress("Building timeline", 72);

  // Build timeline
  const timeline = await buildTimeline(osintData, associates);

  progress("Analyzing location coherence", 73);

  // Analyze location coherence
  const locationCoherence = analyzeLocationCoherence(
    ipNetInfo,
    phoneInfo,
    imagesInfo,
  );

  progress("Analyzing social footprint", 74);

  // Analyze social footprint
  const socialFootprint = analyzeSocialFootprint(existingProfiles, associates);

  progress("Building technical profile", 75);

  // Build technical profile
  const technicalProfile = buildTechnicalProfile(
    domainInfo,
    ipNetInfo,
    emailDomain,
  );

  progress("Building crypto profile", 76);

  // Build crypto profile
  const cryptoProfile = buildCryptoProfile(cryptoInfo);

  progress("Calculating risk score", 77);

  // Calculate risk score
  const { riskFactors, riskScore, riskLevel, verdict } = calculateRiskScore(
    osintData,
    emailInfo,
    breachExposure,
    locationCoherence,
    existingProfiles,
    associates,
    recordsInfo,
    deepInfo,
    cryptoProfile,
  );

  progress("Assembling narrative + findings", 78);

  // Build action log
  const actionLog = buildActionLog(
    osintData,
    breachExposure.breach_count,
    identityGraph.handles,
    existingProfiles,
    identityGraph,
    locationCoherence,
  );

  // Build presentation
  const presentation = buildPresentation(
    osintData,
    riskScore,
    identityGraph.handles,
    existingProfiles,
    identityGraph,
    breachExposure.breach_count,
    (recordsInfo?.criminal?.items || []).length,
  );

  // Build heuristic analysis
  const heuristicAnalysis = {
    summary: `Analysis completed for ${osintData.target_type}: ${osintData.target_value}. ${riskFactors.length} signals identified including ${breachExposure.breach_count} breaches.`,
    investigation_narrative: `The investigation into ${osintData.target_value} has concluded. We identified ${riskFactors.length} risk signals, with a risk score of ${riskScore}/100. ${existingProfiles.length} social profiles and ${breachExposure.breach_count} data breaches were found.`,
    action_log: actionLog,
    key_findings: riskFactors,
    verdict,
    anomalies: riskFactors.join("; "),
    risk_score: riskScore,
    risk_level: riskLevel,
    entity_correlation: `Evidence across ${identityGraph.handles.length} handle(s) and ${existingProfiles.length} social profile(s)`,
    recommendations:
      riskScore > 50
        ? "Further investigation recommended"
        : "Standard monitoring sufficient",
    analysis_timestamp: new Date().toISOString(),
    identity_graph: identityGraph,
    breach_exposure: breachExposure,
    location_coherence: locationCoherence,
    social_footprint: socialFootprint,
    technical_profile: technicalProfile,
    crypto_profile: cryptoProfile,
    associates_analysis: associates,
    timeline_events: timeline,
    presentation,
  };

  progress("Extracting confirmed data", 78.5);

  // Extract confirmed data
  const confirmedData = extractConfirmedData(
    heuristicAnalysis,
    osintData,
    baseEmail,
    emailLocal,
    emailDomain,
    existingProfiles,
  );

  if (confirmedData) {
    heuristicAnalysis.confirmed_data = confirmedData;
  }

  progress("Enhancing analysis with AI (may take ~30s)", 79);

  // Enhance with AI (bounded so investigations don't stall indefinitely)
  const enhancedAnalysis = await enhanceWithAI(osintData, heuristicAnalysis, {
    timeoutMs: 30000,
    // NEW: default to Haiku for investigation enhancement unless caller overrides
    integration: "ANTHROPIC_CLAUDE_HAIKU",
  });

  return enhancedAnalysis;
}
