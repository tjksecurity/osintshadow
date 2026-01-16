import {
  ClipboardList,
  Sparkles,
  CheckCircle,
  Globe,
  Image as ImageIcon,
  Map as MapIcon,
  FileText,
  Gavel,
  Users,
  Calendar,
  MessageSquare,
  UserCheck,
  GitCompare,
} from "lucide-react";

const tabs = [
  { id: "overview", label: "Overview", icon: ClipboardList },
  // Move Report up so it's always visible without horizontal scrolling
  { id: "report", label: "Report", icon: FileText },
  { id: "ai", label: "AI Analysis", icon: Sparkles },
  { id: "timeline", label: "Timeline", icon: Calendar },
  { id: "associates", label: "Associates", icon: UserCheck },
  { id: "confirmed", label: "Confirmed Data", icon: CheckCircle },
  { id: "deconfliction", label: "Deconfliction", icon: GitCompare },
  { id: "osint", label: "OSINT Data", icon: Globe },
  { id: "social", label: "Social Media", icon: Users },
  { id: "posts", label: "Social Posts", icon: MessageSquare },
  { id: "images", label: "Images", icon: ImageIcon },
  { id: "records", label: "Records", icon: Gavel },
  { id: "map", label: "Map", icon: MapIcon },
];

export function TabNavigation({ activeTab, onTabChange }) {
  return (
    <div className="flex items-center gap-2 border-b border-[#37425B] overflow-x-auto whitespace-nowrap">
      {tabs.map((t) => {
        const Icon = t.icon;
        const active = activeTab === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onTabChange(t.id)}
            className={`px-3 py-2 text-sm border-b-2 -mb-[1px] flex items-center gap-2 ${
              active
                ? "border-[#00D1FF] text-white"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <Icon size={16} /> {t.label}
          </button>
        );
      })}
    </div>
  );
}
