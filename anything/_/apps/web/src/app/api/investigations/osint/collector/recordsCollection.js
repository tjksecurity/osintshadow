import {
  propertyRecordsByAddress,
  courtFilingsByName,
  criminalBackgroundByName,
} from "../records.js";

export async function collectPropertyRecords(targetType, targetValue, data) {
  try {
    if (data.flags.include_property && targetType === "address") {
      const res = await propertyRecordsByAddress(targetValue);
      data.records.property_deeds.items = res.items || [];
      data.records.property_deeds.errors = res.errors || [];
    }
  } catch (e) {
    data.records.property_deeds.errors.push(e.message);
  }
}

export async function collectCourtRecords(targetType, targetValue, data) {
  try {
    if (data.flags.include_court) {
      const query =
        targetType === "name"
          ? targetValue
          : targetType === "email" || targetType === "username"
            ? targetValue
            : null;
      if (query) {
        const res = await courtFilingsByName(query);
        data.records.court_filings.items = res.items || [];
        data.records.court_filings.errors = res.errors || [];
      }
    }
  } catch (e) {
    data.records.court_filings.errors.push(e.message);
  }
}

export async function collectCriminalRecords(targetType, targetValue, data) {
  try {
    if (data.flags.include_criminal) {
      const query =
        targetType === "name"
          ? targetValue
          : targetType === "email" || targetType === "username"
            ? targetValue
            : null;
      if (query) {
        const res = await criminalBackgroundByName(query);
        data.records.criminal.items = res.items || [];
        data.records.criminal.errors = res.errors || [];
      }
    }
  } catch (e) {
    data.records.criminal.errors.push(e.message);
  }
}
