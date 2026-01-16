import { useState } from "react";

function JSONNode({ label, value, level = 0 }) {
  const [open, setOpen] = useState(true);
  const isArray = Array.isArray(value);
  const isObject = value && typeof value === "object" && !isArray;
  const indentStyle = { paddingLeft: `${level * 12}px` };

  if (value === null || value === undefined) {
    return (
      <div style={indentStyle} className="text-slate-400 text-sm italic">
        {label != null ? `${label}: ` : ""}null
      </div>
    );
  }

  if (!isArray && !isObject) {
    const text = typeof value === "string" ? value : String(value);
    return (
      <div style={indentStyle} className="text-slate-200 text-sm break-words">
        {label != null && <span className="text-slate-400 mr-1">{label}:</span>}
        <span>{text}</span>
      </div>
    );
  }

  const count = isArray ? value.length : Object.keys(value || {}).length;
  const header = isArray ? `Array (${count})` : `Object (${count})`;

  return (
    <div className="text-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={indentStyle}
        className="w-full text-left py-1.5 hover:bg-[#37425B] rounded flex items-center gap-2"
      >
        <span
          className={`inline-block w-4 h-4 text-center leading-4 rounded-sm ${
            open
              ? "bg-[#00D1FF]/20 text-[#00D1FF]"
              : "bg-slate-600/40 text-slate-300"
          }`}
        >
          {open ? "−" : "+"}
        </span>
        {label != null && <span className="text-slate-300">{label}</span>}
        <span className="text-slate-400">{header}</span>
      </button>
      {open && (
        <div className="mt-1">
          {isArray
            ? value.map((v, i) => (
                <JSONNode
                  key={i}
                  label={`[${i}]`}
                  value={v}
                  level={level + 1}
                />
              ))
            : Object.entries(value).map(([k, v]) => (
                <JSONNode key={k} label={k} value={v} level={level + 1} />
              ))}
        </div>
      )}
    </div>
  );
}

export function JSONViewer({ data }) {
  return (
    <div className="border border-[#37425B] rounded-lg p-3 bg-[#283247] overflow-auto">
      <JSONNode value={data} level={0} />
    </div>
  );
}
