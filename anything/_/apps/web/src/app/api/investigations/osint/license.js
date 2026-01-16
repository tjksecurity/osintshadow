import { safeFetch } from "./helpers.js";

// Normalized response format for license plate lookups
// items: [{ plate, state, vin, vehicle: { year, make, model, trim, body, color },
//           registration: { issued_on, expires_on }, owner: { name }, lienholders: [], source: { name, url }, raw }]
// errors: [string]

export async function licenseRecordsByPlate(plate, stateOrRegion) {
  const items = [];
  const errors = [];

  const plateTrimmed = String(plate || "").trim();
  const region = String(stateOrRegion || "")
    .trim()
    .toUpperCase();

  if (!plateTrimmed) {
    return { items: [], errors: ["Missing plate"] };
  }

  // Provider-agnostic integration via environment variables
  // Configure your preferred provider in:
  //  - process.env.LICENSE_PLATE_API_URL (e.g., https://provider.example.com/plate-lookup)
  //  - process.env.LICENSE_PLATE_API_KEY (Bearer/API key value)
  // The service should accept plate and state parameters.
  const apiUrl = process.env.LICENSE_PLATE_API_URL;
  const apiKey = process.env.LICENSE_PLATE_API_KEY;

  if (!apiUrl || !apiKey) {
    return {
      items: [],
      errors: [
        "License plate lookup not configured. Set LICENSE_PLATE_API_URL and LICENSE_PLATE_API_KEY to enable.",
      ],
    };
  }

  try {
    const url = `${apiUrl}?plate=${encodeURIComponent(plateTrimmed)}${region ? `&state=${encodeURIComponent(region)}` : ""}`;
    const res = await safeFetch(url, {
      timeoutMs: 12000,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      errors.push(`Plate provider response ${res.status}`);
    } else {
      const data = await res.json().catch(() => null);
      if (!data) {
        errors.push("Plate provider returned invalid JSON");
      } else {
        // Try to normalize common shapes while preserving raw
        const normalized = normalizePlateResult(
          data,
          plateTrimmed,
          region,
          apiUrl,
        );
        if (Array.isArray(normalized) && normalized.length) {
          items.push(...normalized);
        } else if (normalized) {
          items.push(normalized);
        } else {
          // Fallback: store raw with minimal fields
          items.push({
            plate: plateTrimmed,
            state: region || null,
            source: { name: "Plate Provider", url },
            raw: data,
          });
        }
      }
    }
  } catch (e) {
    errors.push(e.message);
  }

  return { items, errors };
}

function normalizePlateResult(raw, plate, state, sourceUrl) {
  // Attempt to support a few common field names from various providers
  const vehicles = [];
  const pushOne = (v) => {
    if (!v) return;
    vehicles.push({
      plate: v.plate || plate || null,
      state: v.state || state || null,
      vin: v.vin || v.VIN || v.vehicle_vin || null,
      vehicle: {
        year: v.year || v.vehicle_year || v.model_year || null,
        make: v.make || v.vehicle_make || null,
        model: v.model || v.vehicle_model || null,
        trim: v.trim || null,
        body: v.body_style || v.body || null,
        color: v.color || v.exterior_color || null,
      },
      registration: {
        issued_on: v.registration_issued_on || v.issued_on || null,
        expires_on: v.registration_expires_on || v.expires_on || null,
      },
      owner: v.owner || null,
      lienholders: v.lienholders || [],
      source: { name: "Plate Provider", url: sourceUrl },
      raw: v.raw || raw,
    });
  };

  if (Array.isArray(raw?.results)) {
    raw.results.forEach((r) => pushOne(r));
  } else if (raw?.result) {
    pushOne(raw.result);
  } else if (Array.isArray(raw)) {
    raw.forEach((r) => pushOne(r));
  } else if (typeof raw === "object" && raw) {
    pushOne(raw);
  }

  return vehicles;
}
