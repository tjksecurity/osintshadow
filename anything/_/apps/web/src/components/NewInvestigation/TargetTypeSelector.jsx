export function TargetTypeSelector({ targetTypes, targetType, setTargetType }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-3">
        Investigation Type
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {targetTypes.map((type) => {
          const IconComponent = type.icon;
          return (
            <button
              key={type.value}
              type="button"
              onClick={() => setTargetType(type.value)}
              className={`p-4 rounded-lg border transition-all ${
                targetType === type.value
                  ? "border-[#00D1FF] bg-[#00D1FF]/10"
                  : "border-[#37425B] hover:border-[#37425B]/80"
              }`}
            >
              <div className="flex flex-col items-center gap-2">
                <IconComponent
                  size={24}
                  className={
                    targetType === type.value
                      ? "text-[#00D1FF]"
                      : "text-slate-400"
                  }
                />
                <span className="text-sm font-medium">{type.label}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
