import {
  createOSINTEnvelope,
  createCrossRefs,
  createProgressReporter,
} from "./collector/dataStructure.js";
import {
  handleEmailTarget,
  handleUsernameTarget,
  handlePhoneTarget,
  handleDomainTarget,
  handleIPTarget,
  handleLicensePlateTarget,
} from "./collector/targetHandlers.js";
import {
  enrichNetworkData,
  enrichDomainAssets,
} from "./collector/networkEnrichment.js";
import {
  collectPhoneSeeds,
  collectHubDiscovery,
} from "./collector/seedCollection.js";
import {
  collectBreachIntel,
  collectMentionsIntel,
  collectDeepWebDiscovery,
} from "./collector/intelCollection.js";
import { refreshUsernameIntel } from "./collector/usernameRefresh.js";
import {
  collectImageCandidates,
  finalizeImageIntel,
} from "./collector/imageCollection.js";
import {
  collectPropertyRecords,
  collectCourtRecords,
  collectCriminalRecords,
} from "./collector/recordsCollection.js";
import {
  collectConnections,
  seedDiscoveredUrlsFromProfiles,
} from "./collector/connectionsCollection.js";

export async function collectOSINT(targetType, targetValue, options = {}) {
  const data = createOSINTEnvelope(targetType, targetValue, options);
  const report = createProgressReporter(options.onProgress);

  try {
    const crossRefs = createCrossRefs();
    const imageCandidates = new Map();

    report({
      phase: "osint",
      step: "seed",
      percent: 12,
      message: `Parsing target and seeding lookups (${targetType})`,
    });

    // Handle different target types
    if (targetType === "email") {
      await handleEmailTarget(targetValue, data, crossRefs);
    } else if (targetType === "username") {
      await handleUsernameTarget(targetValue, data, crossRefs);
    } else if (targetType === "phone") {
      await handlePhoneTarget(targetValue, data, crossRefs);
    } else if (targetType === "domain") {
      await handleDomainTarget(targetValue, data, crossRefs);
    } else if (targetType === "ip") {
      await handleIPTarget(targetValue, data);
    } else if (targetType === "license_plate") {
      await handleLicensePlateTarget(targetValue, data);
    }

    report({
      phase: "osint",
      step: "network",
      percent: 15,
      message: "Enriching IP/network signals",
    });

    await enrichNetworkData(data);
    await enrichDomainAssets(data, imageCandidates);

    report({
      phase: "osint",
      step: "directories",
      percent: 18,
      message: "Checking public directories and profile hubs",
    });

    await collectPhoneSeeds(data, crossRefs, targetType);
    await collectHubDiscovery(data, crossRefs, targetType);

    report({
      phase: "osint",
      step: "mentions",
      percent: 20,
      message: "Searching web mentions and link references",
    });

    try {
      await collectBreachIntel(targetType, targetValue, data);
      await collectMentionsIntel(targetType, targetValue, data);

      report({
        phase: "osint",
        step: "deep_discovery",
        percent: 23,
        message: "Scanning discovered pages for extra emails/phones",
      });

      const moreEmails = await collectDeepWebDiscovery(data);
      crossRefs.emails.push(...(moreEmails || []).map((e) => e.email));
    } catch {}

    // Second pass: refresh username intel with cross-references
    await refreshUsernameIntel(data, crossRefs);

    report({
      phase: "osint",
      step: "images",
      percent: 26,
      message: "Extracting candidate images",
    });

    await collectImageCandidates(data, imageCandidates);
    await finalizeImageIntel(data, imageCandidates);

    report({
      phase: "osint",
      step: "records",
      percent: 28,
      message: "Checking public records sources",
    });

    await collectPropertyRecords(targetType, targetValue, data);
    await collectCourtRecords(targetType, targetValue, data);
    await collectCriminalRecords(targetType, targetValue, data);

    report({
      phase: "osint",
      step: "connections",
      percent: 29,
      message: "Mapping basic connections (family/friends/associates)",
    });

    await collectConnections(targetType, targetValue, data);
    seedDiscoveredUrlsFromProfiles(data);
  } catch (e) {
    data.error = e.message;
  }
  return data;
}
