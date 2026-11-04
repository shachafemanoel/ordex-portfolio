'use client';

export type MapOverlayChip = {
  id: string;
  label: string;
  value: string;
  tone?: 'danger' | 'warning' | 'info' | 'success';
};

const toneClass: Record<NonNullable<MapOverlayChip['tone']>, string> = {
  danger:
    'border-[color-mix(in_srgb,var(--color-danger-500)_22%,transparent)] bg-surface-translucent-strong text-danger',
  warning:
    'border-[color-mix(in_srgb,var(--color-warning-500)_22%,transparent)] bg-surface-translucent-strong text-warning',
  info:
    'border-[color-mix(in_srgb,var(--color-primary-500)_22%,transparent)] bg-surface-translucent-strong text-info',
  success:
    'border-[color-mix(in_srgb,var(--color-success-500)_22%,transparent)] bg-surface-translucent-strong text-success',
};

export function MapOverlayChips({ chips }: { chips?: MapOverlayChip[] | null }) {
  const safeChips = Array.isArray(chips) ? chips : [];
  if (!safeChips.length) return null;

  return (
    <div className="pointer-events-auto flex flex-wrap justify-end gap-2">
      {safeChips.map((chip) => (
        <div
          key={chip.id}
          className={[
            'shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-black shadow-[0_12px_30px_-18px_rgba(15,23,42,0.5)] backdrop-blur-xl',
            chip.tone ? toneClass[chip.tone] : toneClass.info,
          ].join(' ')}
        >
          <span className="text-[10px] uppercase tracking-[0.18em] opacity-70">{chip.label}</span>
          <span className="mx-1 opacity-45">•</span>
          <span>{chip.value}</span>
        </div>
      ))}
    </div>
  );
}
