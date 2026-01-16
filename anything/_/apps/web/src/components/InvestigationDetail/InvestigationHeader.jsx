import { ArrowLeft, RefreshCw, Sparkles, MessageSquare } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

export function InvestigationHeader({
  investigation,
  statusBadge,
  onRefresh,
  onRegenerate,
  isRegenerating,
}) {
  // Safeguard: avoid direct property access if investigation is null/undefined
  const invId = investigation?.id;
  const invType = investigation?.target_type || "";
  const invValue = investigation?.target_value || "";

  const aiChatHref = invId ? `/ai/chat?investigationId=${invId}` : "/ai/chat";

  return (
    <header className="border-b border-[#37425B]">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="p-2 hover:bg-[#37425B] rounded-lg">
            <ArrowLeft size={18} />
          </a>
          <BrandLogo className="h-6 w-auto" variant="onDark" />
          <div>
            <div className="font-semibold">
              {invId ? `Investigation #${invId}` : "Investigation"}
            </div>
            <div className="text-slate-400 text-sm">
              {invType}: {invValue}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {statusBadge}
          <a
            href={aiChatHref}
            className="px-3 py-1.5 border border-[#37425B] rounded hover:bg-[#37425B] flex items-center gap-2"
          >
            <MessageSquare size={16} /> Ask OSINT Copilot
          </a>
          <button
            onClick={onRefresh}
            className="px-3 py-1.5 border border-[#37425B] rounded hover:bg-[#37425B] flex items-center gap-2"
          >
            <RefreshCw size={16} /> Refresh
          </button>
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="px-3 py-1.5 border border-[#37425B] rounded hover:bg-[#37425B] flex items-center gap-2 disabled:opacity-60"
          >
            <Sparkles size={16} />
            {isRegenerating ? "Regenerating…" : "Regenerate with AI"}
          </button>
        </div>
      </div>
    </header>
  );
}
