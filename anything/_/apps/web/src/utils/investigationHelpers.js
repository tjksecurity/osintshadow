export const parseSeverity = (text) => {
  const t = (text || "").toLowerCase();
  if (/(critical|severe|high risk|p1|high)/.test(t)) return "high";
  if (/(medium|moderate|p2)/.test(t)) return "medium";
  if (/(low|minor|p3)/.test(t)) return "low";
  return "unknown";
};

export const chipClasses = (sev) => {
  switch (sev) {
    case "high":
      return "bg-red-500/10 text-red-300 border border-red-500/20";
    case "medium":
      return "bg-yellow-500/10 text-yellow-300 border border-yellow-500/20";
    case "low":
      return "bg-green-500/10 text-green-300 border border-green-500/20";
    default:
      return "bg-slate-500/10 text-slate-300 border border-slate-500/20";
  }
};

export const riskColor = (score) => {
  if (score == null) return "text-slate-400";
  if (score >= 70) return "text-red-400";
  if (score >= 40) return "text-yellow-400";
  return "text-green-400";
};

export const getStatusBadge = (status) => {
  const base = "px-2 py-1 rounded text-xs inline-flex items-center gap-1";

  const badges = {
    completed: {
      className: `${base} bg-green-500/10 text-green-300`,
      icon: "CheckCircle",
      text: "Completed",
    },
    processing: {
      className: `${base} bg-yellow-500/10 text-yellow-300`,
      icon: "Clock",
      text: "Processing",
    },
    failed: {
      className: `${base} bg-red-500/10 text-red-300`,
      icon: "XCircle",
      text: "Failed",
    },
    default: {
      className: `${base} bg-slate-500/10 text-slate-300`,
      icon: "Clock",
      text: "Queued",
    },
  };

  return badges[status] || badges.default;
};
