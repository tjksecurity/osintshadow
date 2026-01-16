export function TargetValueInput({
  selectedType,
  targetValue,
  setTargetValue,
  targetType,
  plateRegion,
  setPlateRegion,
}) {
  const usStates = [
    "",
    "AL",
    "AK",
    "AZ",
    "AR",
    "CA",
    "CO",
    "CT",
    "DE",
    "FL",
    "GA",
    "HI",
    "ID",
    "IL",
    "IN",
    "IA",
    "KS",
    "KY",
    "LA",
    "ME",
    "MD",
    "MA",
    "MI",
    "MN",
    "MS",
    "MO",
    "MT",
    "NE",
    "NV",
    "NH",
    "NJ",
    "NM",
    "NY",
    "NC",
    "ND",
    "OH",
    "OK",
    "OR",
    "PA",
    "RI",
    "SC",
    "SD",
    "TN",
    "TX",
    "UT",
    "VT",
    "VA",
    "WA",
    "WV",
    "WI",
    "WY",
  ];

  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-2">
        {selectedType?.label}
      </label>
      <div className="relative">
        <selectedType.icon
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          size={20}
        />
        <input
          type="text"
          value={targetValue}
          onChange={(e) => setTargetValue(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-[#37425B] border border-[#37425B] rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-[#00D1FF] focus:ring-1 focus:ring-[#00D1FF]"
          placeholder={selectedType?.placeholder}
          required
        />
      </div>
      <p className="text-slate-400 text-sm mt-2">
        Enter the {selectedType?.label.toLowerCase()} you want to investigate
      </p>
      {targetType === "license_plate" && (
        <div className="mt-3">
          <label className="block text-sm mb-1 text-slate-300">
            State/Region (optional)
          </label>
          <select
            value={plateRegion}
            onChange={(e) => setPlateRegion(e.target.value)}
            className="w-full bg-[#37425B] border border-[#37425B] rounded-lg px-3 py-2 text-sm"
          >
            {usStates.map((s) => (
              <option key={s || "none"} value={s}>
                {s ? s : "Not specified"}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">
            Some providers require a state for accurate results.
          </p>
        </div>
      )}
    </div>
  );
}
