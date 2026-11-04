'use client';

export type MapLegendItem = {
  id: string;
  label: string;
  color: string;
};

export function MapLegend({
  title,
  items,
}: {
  title: string;
  items?: MapLegendItem[] | null;
}) {
  const safeItems = Array.isArray(items) ? items : [];
  if (!safeItems.length) return null;

  return (
    <div className="pointer-events-auto w-full max-w-[320px] rounded-[22px] border border-surface-strong bg-surface-translucent-strong p-3 shadow-[0_24px_60px_-34px_rgba(15,23,42,0.5)] backdrop-blur-xl">
      <div className="text-[10px] font-black tracking-[0.18em] text-ops-icon-muted">{title}</div>
      <div className="mt-3 space-y-2">
        {safeItems.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-2 rounded-[14px] border border-subtle-light bg-surface-translucent px-3 py-2"
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-xs font-semibold text-fg">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
