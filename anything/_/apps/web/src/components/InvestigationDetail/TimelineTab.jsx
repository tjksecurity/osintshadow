import React from "react";
import { Calendar, Clock, AlertTriangle, Info, Shield } from "lucide-react";

export default function TimelineTab({ investigation }) {
  // ai_analysis comes back as the full JSON object (from ai_output.full_json).
  // Some older callers used ai_analysis.full_json, so support both.
  const aiJson =
    investigation?.ai_analysis?.full_json ?? investigation?.ai_analysis ?? {};

  const timeline = aiJson.timeline_events || {};
  const events = Array.isArray(timeline.events) ? timeline.events : [];

  const timelineAnalysis = timeline.analysis || {};
  const clusters = Array.isArray(timelineAnalysis.clusters)
    ? timelineAnalysis.clusters
    : [];
  const patterns = Array.isArray(timelineAnalysis.patterns)
    ? timelineAnalysis.patterns
    : [];

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case "high":
        return <AlertTriangle className="w-4 h-4 text-red-300" />;
      case "medium":
        return <Shield className="w-4 h-4 text-yellow-300" />;
      case "low":
        return <Info className="w-4 h-4 text-blue-300" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const getEventTypeColor = (eventType) => {
    switch (eventType) {
      case "data_breach":
        return "bg-red-500/10 border-red-500/20 text-red-200";
      case "legal_event":
        return "bg-orange-500/10 border-orange-500/20 text-orange-200";
      case "account_creation":
        return "bg-green-500/10 border-green-500/20 text-green-200";
      case "associate_discovery":
        return "bg-purple-500/10 border-purple-500/20 text-purple-200";
      default:
        return "bg-[#303B52] border-[#37425B] text-slate-200";
    }
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Unknown date";
    }
  };

  if (events.length === 0) {
    return (
      <section className="bg-[#2D384E] border border-[#37425B] rounded-lg p-6">
        <div className="text-center py-8">
          <Calendar className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">
            No Timeline Data Available
          </h3>
          <p className="text-slate-400">
            Timeline events will appear here when the AI analysis finishes.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-[#2D384E] border border-[#37425B] rounded-lg p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-2 flex items-center">
          <Calendar className="w-5 h-5 mr-2 text-[#00D1FF]" />
          Investigation Timeline
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-[#303B52] border border-[#37425B] p-4 rounded-lg">
            <div className="text-sm text-slate-300 font-medium">
              Total Events
            </div>
            <div className="text-2xl font-bold text-white">{events.length}</div>
          </div>
          <div className="bg-[#303B52] border border-[#37425B] p-4 rounded-lg">
            <div className="text-sm text-slate-300 font-medium">Date Range</div>
            <div className="text-sm text-slate-200">
              {timeline.date_range?.earliest
                ? formatDate(timeline.date_range.earliest)
                : "N/A"}{" "}
              –
              {timeline.date_range?.latest
                ? ` ${formatDate(timeline.date_range.latest)}`
                : " N/A"}
            </div>
          </div>
          <div className="bg-[#303B52] border border-[#37425B] p-4 rounded-lg">
            <div className="text-sm text-slate-300 font-medium">
              Activity Clusters
            </div>
            <div className="text-2xl font-bold text-white">
              {clusters.length}
            </div>
          </div>
        </div>

        {(clusters.length > 0 || patterns.length > 0) && (
          <div className="mb-6 bg-[#263043] border border-[#37425B] p-4 rounded-lg">
            <h4 className="font-semibold text-white mb-3">Timeline Analysis</h4>

            {clusters.length > 0 && (
              <div className="mb-4">
                <h5 className="text-sm font-medium text-slate-200 mb-2">
                  Activity Clusters
                </h5>
                <div className="space-y-2">
                  {clusters.map((cluster, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-[#2D384E] border border-[#37425B] p-3 rounded"
                    >
                      <div>
                        <div className="font-medium text-sm text-white">
                          {cluster.year}
                        </div>
                        <div className="text-xs text-slate-400">
                          {cluster.description}
                        </div>
                      </div>
                      <div className="text-lg font-bold text-[#00D1FF]">
                        {cluster.event_count}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {patterns.length > 0 && (
              <div>
                <h5 className="text-sm font-medium text-slate-200 mb-2">
                  Detected Patterns
                </h5>
                <div className="space-y-2">
                  {patterns.map((pattern, index) => {
                    const severity = pattern.severity;
                    const boxClass =
                      severity === "high"
                        ? "bg-red-500/10 border-red-500/20"
                        : severity === "medium"
                          ? "bg-yellow-500/10 border-yellow-500/20"
                          : "bg-blue-500/10 border-blue-500/20";

                    return (
                      <div
                        key={index}
                        className={`p-3 rounded border ${boxClass}`}
                      >
                        <div className="flex items-center">
                          {getSeverityIcon(severity)}
                          <span className="ml-2 font-medium text-sm text-white">
                            {String(pattern.type || "pattern")
                              .replace(/_/g, " ")
                              .toUpperCase()}
                          </span>
                        </div>
                        <div className="text-xs text-slate-300 mt-1">
                          {pattern.description}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h4 className="font-semibold text-white flex items-center">
          <Clock className="w-4 h-4 mr-2 text-[#00D1FF]" />
          Event Timeline
        </h4>

        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-px bg-[#37425B]"></div>

          <div className="space-y-6">
            {events.map((event, index) => (
              <div key={index} className="relative flex items-start">
                <div className="absolute left-4 w-4 h-4 rounded-full border-2 border-[#2D384E] bg-[#37425B] shadow-sm flex items-center justify-center">
                  {getSeverityIcon(event.severity)}
                </div>

                <div className="ml-12 flex-1">
                  <div
                    className={`p-4 rounded-lg border ${getEventTypeColor(event.event_type)}`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-2">
                      <h5 className="font-semibold text-sm text-white">
                        {event.title || "Event"}
                      </h5>
                      <span className="text-xs bg-[#263043] border border-[#37425B] px-2 py-1 rounded text-slate-300">
                        {formatDate(event.timestamp)}
                      </span>
                    </div>

                    <p className="text-sm text-slate-200 mb-3">
                      {event.description}
                    </p>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                      <span className="text-slate-300">
                        Source: {event.source || "Unknown"}
                      </span>
                      <span className="text-slate-400 capitalize">
                        {String(event.event_type || "event").replace(/_/g, " ")}
                      </span>
                    </div>

                    {event.details && Object.keys(event.details).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-[#37425B]">
                        <div className="text-xs space-y-1">
                          {Object.entries(event.details).map(([key, value]) => (
                            <div
                              key={key}
                              className="flex justify-between gap-3"
                            >
                              <span className="font-medium text-slate-300 capitalize">
                                {String(key).replace(/_/g, " ")}:
                              </span>
                              <span className="text-slate-400 ml-2 break-words text-right">
                                {typeof value === "object"
                                  ? JSON.stringify(value)
                                  : String(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
