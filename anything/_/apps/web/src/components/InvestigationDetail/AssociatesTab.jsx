import React, { useMemo, useState } from "react";
import {
  Users,
  AlertTriangle,
  Search,
  Filter,
  UserCheck,
  Heart,
  Gavel,
  Home,
  MessageSquare,
} from "lucide-react";

export default function AssociatesTab({ investigation }) {
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // ai_analysis comes back as the full JSON object (from ai_output.full_json).
  // Some older callers used ai_analysis.full_json, so support both.
  const aiJson =
    investigation?.ai_analysis?.full_json ?? investigation?.ai_analysis ?? {};

  const associates = Array.isArray(aiJson.associates_analysis)
    ? aiJson.associates_analysis
    : [];

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const getRelationshipIcon = (type) => {
    switch (type) {
      case "family":
        return <Heart className="w-4 h-4 text-red-300" />;
      case "social_connection":
        return <MessageSquare className="w-4 h-4 text-blue-300" />;
      case "legal_connection":
        return <Gavel className="w-4 h-4 text-orange-300" />;
      case "property_connection":
        return <Home className="w-4 h-4 text-green-300" />;
      default:
        return <UserCheck className="w-4 h-4 text-slate-300" />;
    }
  };

  const getRelationshipPill = (type) => {
    const label = String(type || "unknown").replace(/_/g, " ");
    const base = "px-2 py-1 rounded-full text-xs font-medium border";

    switch (type) {
      case "family":
        return {
          label,
          className: `${base} bg-red-500/10 border-red-500/20 text-red-200`,
        };
      case "social_connection":
        return {
          label,
          className: `${base} bg-blue-500/10 border-blue-500/20 text-blue-200`,
        };
      case "legal_connection":
        return {
          label,
          className: `${base} bg-orange-500/10 border-orange-500/20 text-orange-200`,
        };
      case "property_connection":
        return {
          label,
          className: `${base} bg-green-500/10 border-green-500/20 text-green-200`,
        };
      default:
        return {
          label,
          className: `${base} bg-[#303B52] border-[#37425B] text-slate-200`,
        };
    }
  };

  const getConfidencePill = (confidence) => {
    const c = typeof confidence === "number" ? confidence : 0;
    const label = `${Math.round(c * 100)}%`;
    const base = "px-2 py-1 rounded-full text-xs font-medium border";

    if (c >= 0.8)
      return {
        label,
        className: `${base} text-green-200 bg-green-500/10 border-green-500/20`,
      };
    if (c >= 0.6)
      return {
        label,
        className: `${base} text-yellow-200 bg-yellow-500/10 border-yellow-500/20`,
      };
    return {
      label,
      className: `${base} text-red-200 bg-red-500/10 border-red-500/20`,
    };
  };

  const relationshipTypes = useMemo(() => {
    const unique = new Set(
      associates.map((a) => a?.relationship_type).filter(Boolean),
    );
    return ["all", ...Array.from(unique)];
  }, [associates]);

  const associateCounts = useMemo(() => {
    return associates.reduce((acc, associate) => {
      const key = associate?.relationship_type || "unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [associates]);

  const highRiskAssociates = useMemo(() => {
    return associates.filter(
      (a) => Array.isArray(a?.risk_indicators) && a.risk_indicators.length > 0,
    );
  }, [associates]);

  const filteredAssociates = useMemo(() => {
    return associates.filter((associate) => {
      const name = String(associate?.name || "").toLowerCase();
      const contexts = Array.isArray(associate?.contexts)
        ? associate.contexts
        : [];

      const matchesSearch =
        !normalizedSearch ||
        name.includes(normalizedSearch) ||
        contexts.some((c) =>
          String(c || "")
            .toLowerCase()
            .includes(normalizedSearch),
        );

      const matchesFilter =
        selectedFilter === "all" ||
        associate?.relationship_type === selectedFilter;

      return matchesSearch && matchesFilter;
    });
  }, [associates, normalizedSearch, selectedFilter]);

  if (!associates.length) {
    return (
      <section className="bg-[#2D384E] border border-[#37425B] rounded-lg p-6">
        <div className="text-center py-8">
          <Users className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">
            No Associates Found
          </h3>
          <p className="text-slate-400">
            Associates and connections will appear here when AI analysis
            finishes.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-[#2D384E] border border-[#37425B] rounded-lg p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
          <Users className="w-5 h-5 mr-2 text-[#00D1FF]" />
          Known Associates & Connections
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#303B52] border border-[#37425B] p-4 rounded-lg">
            <div className="text-sm text-slate-300 font-medium">Total</div>
            <div className="text-2xl font-bold text-white">
              {associates.length}
            </div>
          </div>
          <div className="bg-[#303B52] border border-[#37425B] p-4 rounded-lg">
            <div className="text-sm text-slate-300 font-medium">Family</div>
            <div className="text-2xl font-bold text-white">
              {associateCounts.family || 0}
            </div>
          </div>
          <div className="bg-[#303B52] border border-[#37425B] p-4 rounded-lg">
            <div className="text-sm text-slate-300 font-medium">Social</div>
            <div className="text-2xl font-bold text-white">
              {associateCounts.social_connection || 0}
            </div>
          </div>
          <div className="bg-[#303B52] border border-[#37425B] p-4 rounded-lg">
            <div className="text-sm text-slate-300 font-medium">High Risk</div>
            <div className="text-2xl font-bold text-white">
              {highRiskAssociates.length}
            </div>
          </div>
        </div>

        {highRiskAssociates.length > 0 && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 p-4 rounded-lg">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-red-300 mr-2" />
              <h4 className="font-semibold text-red-200">
                High Risk Associates Detected
              </h4>
            </div>
            <p className="text-sm text-slate-300 mt-2">
              {highRiskAssociates.length} associate(s) have risk indicators
              requiring attention.
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search associates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#37425B] border border-[#37425B] rounded-lg focus:outline-none focus:border-[#00D1FF] text-slate-100"
            />
          </div>

          <div className="relative">
            <Filter className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <select
              value={selectedFilter}
              onChange={(e) => setSelectedFilter(e.target.value)}
              className="pl-10 pr-8 py-2 bg-[#37425B] border border-[#37425B] rounded-lg focus:outline-none focus:border-[#00D1FF] text-slate-100 appearance-none"
            >
              {relationshipTypes.map((type) => (
                <option key={type} value={type}>
                  {type === "all"
                    ? "All Types"
                    : String(type)
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (l) => l.toUpperCase())}
                  {type !== "all" && ` (${associateCounts[type] || 0})`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {filteredAssociates.length > 0 ? (
          filteredAssociates.map((associate, index) => {
            const pill = getRelationshipPill(associate?.relationship_type);
            const conf = getConfidencePill(associate?.confidence);
            const contexts = Array.isArray(associate?.contexts)
              ? associate.contexts
              : [];
            const riskIndicators = Array.isArray(associate?.risk_indicators)
              ? associate.risk_indicators
              : [];
            const sources = Array.isArray(associate?.sources)
              ? associate.sources
              : [];

            return (
              <div
                key={index}
                className="border border-[#37425B] rounded-lg p-4 bg-[#303B52]/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center mb-2 gap-2">
                      {getRelationshipIcon(associate?.relationship_type)}
                      <h4 className="font-semibold text-white">
                        {associate?.name || "Unknown"}
                      </h4>
                      <span className={pill.className}>{pill.label}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">
                          Confidence:
                        </span>
                        <span className={conf.className}>{conf.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Sources:</span>
                        <span className="text-xs text-slate-200">
                          {sources.length}
                        </span>
                      </div>
                    </div>

                    {contexts.length > 0 && (
                      <div className="mb-3">
                        <h5 className="text-xs font-semibold text-slate-300 mb-1">
                          Discovery Context
                        </h5>
                        <div className="space-y-1">
                          {contexts.map((context, ctxIndex) => (
                            <div
                              key={ctxIndex}
                              className="text-xs text-slate-300 bg-[#263043] border border-[#37425B] px-2 py-1 rounded"
                            >
                              {context}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {riskIndicators.length > 0 && (
                      <div className="mb-3">
                        <h5 className="text-xs font-semibold text-red-200 mb-1 flex items-center">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Risk Indicators
                        </h5>
                        <div className="space-y-1">
                          {riskIndicators.map((indicator, riskIndex) => (
                            <div
                              key={riskIndex}
                              className="text-xs text-red-200 bg-red-500/10 px-2 py-1 rounded border border-red-500/20"
                            >
                              {indicator}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {associate?.additional_data &&
                      Object.keys(associate.additional_data).length > 0 && (
                        <div className="mt-3 pt-3 border-t border-[#37425B]">
                          <h5 className="text-xs font-semibold text-slate-300 mb-2">
                            Additional Information
                          </h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {Object.entries(associate.additional_data).map(
                              ([key, value]) => (
                                <div
                                  key={key}
                                  className="flex justify-between gap-2"
                                >
                                  <span className="text-slate-400 capitalize">
                                    {String(key).replace(/_/g, " ")}:
                                  </span>
                                  <span className="text-slate-200 ml-2 break-words text-right">
                                    {String(value)}
                                  </span>
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      )}

                    {sources.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-[#37425B]">
                        <h5 className="text-xs font-semibold text-slate-300 mb-1">
                          Data Sources
                        </h5>
                        <div className="flex flex-wrap gap-1">
                          {sources.map((source, sourceIndex) => (
                            <span
                              key={sourceIndex}
                              className="inline-flex items-center px-2 py-1 bg-[#263043] border border-[#37425B] text-slate-200 text-xs rounded"
                            >
                              {String(source).replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {associate?.discovered_at && (
                      <div className="mt-2 text-xs text-slate-400">
                        Discovered:{" "}
                        {new Date(associate.discovered_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-8 text-slate-400">
            {searchTerm || selectedFilter !== "all"
              ? "No associates match your filters."
              : "No associates found for this investigation."}
          </div>
        )}
      </div>
    </section>
  );
}
