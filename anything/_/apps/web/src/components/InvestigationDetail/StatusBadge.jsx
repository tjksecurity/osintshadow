import { CheckCircle, Clock, XCircle } from "lucide-react";

export function StatusBadge({ status }) {
  const base = "px-2 py-1 rounded text-xs inline-flex items-center gap-1";

  if (status === "completed") {
    return (
      <span className={`${base} bg-green-500/10 text-green-300`}>
        <CheckCircle size={14} />
        Completed
      </span>
    );
  }

  if (status === "processing") {
    return (
      <span className={`${base} bg-yellow-500/10 text-yellow-300`}>
        <Clock size={14} />
        Processing
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span className={`${base} bg-red-500/10 text-red-300`}>
        <XCircle size={14} />
        Failed
      </span>
    );
  }

  return (
    <span className={`${base} bg-slate-500/10 text-slate-300`}>
      <Clock size={14} />
      Queued
    </span>
  );
}
