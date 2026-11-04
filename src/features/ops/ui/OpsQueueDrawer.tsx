'use client';

import { EntityBadge } from '@/components/shared/display/EntityPrimitives';
import { getEntityToneDotClass, mapTaskColorToEntityTone } from '@/components/shared/display/displayStatus';
import { DISPLAY_TEXT } from '@/components/shared/display/displayText';
import type { OpsQueueItem } from '@/src/server/dto/ops.dto';

interface OpsQueueDrawerProps {
  open: boolean;
  title: string;
  items: OpsQueueItem[];
  onClose: () => void;
  onItemClick?: (id: string) => void;
}

/** Slide-over drawer showing full list of items in a queue. */
export function OpsQueueDrawer({ open, title, items, onClose, onItemClick }: OpsQueueDrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
        onClick={onClose}
        aria-label="Close drawer"
      />

      {/* Drawer panel */}
      <div className="relative w-full max-w-sm bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
            <p className="mt-0.5 text-xs text-gray-400">{items.length} פריטים</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors text-lg leading-none"
          >
            &times;
          </button>
        </div>

        <ul className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {items.map((item) => {
            const taskTone = mapTaskColorToEntityTone(item.derivedTask.taskColor);

            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    onItemClick?.(item.id);
                    onClose();
                  }}
                  className="w-full px-4 py-3 text-start transition-colors hover:bg-[#f7fbff]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {item.customerName ?? DISPLAY_TEXT.unknownCustomer}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-gray-500">{item.summary}</p>
                      {item.addressLine ? (
                        <p className="mt-1 truncate text-xs text-slate-500">{item.addressLine}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {item.isUrgent && (
                        <EntityBadge
                          label={DISPLAY_TEXT.urgent}
                          tone="warning"
                          dotClassName={getEntityToneDotClass('warning')}
                          className="px-1.5 py-0.5 tracking-tight"
                        />
                      )}
                      <EntityBadge
                        label={item.derivedTask.statusLabelHe}
                        tone={taskTone}
                        dotClassName={getEntityToneDotClass(taskTone)}
                        className="px-1.5 py-0.5 tracking-[0.1em]"
                      />
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
