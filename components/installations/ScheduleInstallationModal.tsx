'use client';

import { useEffect, useState } from 'react';

interface TechnicianOption {
  id: string;
  name?: string | null;
}

interface ScheduleInstallationModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  technicians: TechnicianOption[];
  onConfirm: (payload: {
    technicianId?: string;
    scheduledAt?: string;
    notes?: string;
  }) => Promise<void> | void;
  isLoading?: boolean;
}

export function ScheduleInstallationModal({
  isOpen,
  onClose,
  order,
  technicians,
  onConfirm,
  isLoading = false,
}: ScheduleInstallationModalProps) {
  const [scheduledAt, setScheduledAt] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setScheduledAt('');
      setTechnicianId(order?.assignedUserId || '');
      setNotes(order?.installerNotes || order?.notes || '');
    }
  }, [isOpen, order]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" dir="rtl">
      <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">תיאום התקנה</h2>
            <p className="text-sm text-gray-500">
              {order?.customerName || order?.customer || 'הזמנה'} #{order?.orderNumber || order?.id}
            </p>
          </div>
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">
            סגור
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">מועד</span>
            <input
              className="w-full rounded-2xl border border-gray-200 px-4 py-3"
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">מתקין</span>
            <select
              className="w-full rounded-2xl border border-gray-200 px-4 py-3"
              value={technicianId}
              onChange={(event) => setTechnicianId(event.target.value)}
            >
              <option value="">ללא שיוך</option>
              {technicians.map((technician) => (
                <option key={technician.id} value={technician.id}>
                  {technician.name || technician.id}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">הערות</span>
            <textarea
              className="min-h-28 w-full rounded-2xl border border-gray-200 px-4 py-3"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700"
            disabled={isLoading}
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={() => onConfirm({ technicianId, scheduledAt, notes })}
            className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-medium text-on-dark disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? 'שומר...' : 'אישור'}
          </button>
        </div>
      </div>
    </div>
  );
}
