'use client';

import apiClient from '@/lib/apiClient';

import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';

export interface DateTimePickerProps {
  value?: Date;
  onChange: (date: Date | null) => void;
  label?: string;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  timeSlots?: string[];
  disabledDays?: number[]; // 0 = Sunday, 1 = Monday, etc.
  error?: string;
}

const DEFAULT_TIME_SLOTS = [
  '08:00',
  '08:30',
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '12:00',
  '12:30',
  '13:00',
  '13:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
  '17:00',
  '17:30',
  '18:00',
  '18:30',
  '19:00',
];

export function DateTimePicker({
  value,
  onChange,
  label,
  placeholder = 'בחר תאריך ושעה',
  minDate,
  maxDate,
  disabled = false,
  required = false,
  className,
  timeSlots = DEFAULT_TIME_SLOTS,
  disabledDays = [],
  error,
}: DateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(value || null);
  const [selectedTime, setSelectedTime] = useState<string>(value ? format(value, 'HH:mm') : '');

  const handleDateChange = (dateStr: string) => {
    if (!dateStr) {
      setSelectedDate(null);
      onChange(null);
      return;
    }

    try {
      const date = new Date(dateStr);

      // Check if day is disabled
      if (disabledDays.includes(date.getDay())) {
        return;
      }

      // Check date range
      if (minDate && date < minDate) {
        return;
      }
      if (maxDate && date > maxDate) {
        return;
      }

      setSelectedDate(date);

      // If we have a time, combine them
      if (selectedTime) {
        const [hours, minutes] = selectedTime.split(':').map(Number);
        const combinedDate = new Date(date);
        combinedDate.setHours(hours, minutes);
        onChange(combinedDate);
      } else {
        onChange(date);
      }
    } catch (error) {
      console.error('Invalid date:', error);
    }
  };

  const handleTimeChange = (time: string) => {
    setSelectedTime(time);

    if (selectedDate && time) {
      const [hours, minutes] = time.split(':').map(Number);
      const combinedDate = new Date(selectedDate);
      combinedDate.setHours(hours, minutes);
      onChange(combinedDate);
    }
  };

  const formatDateForInput = (date: Date | null) => {
    if (!date) return '';
    return format(date, 'yyyy-MM-dd');
  };

  const formatDisplayValue = (date: Date | null) => {
    if (!date) return '';
    return format(date, 'dd/MM/yyyy HH:mm', { locale: he });
  };

  const isTimeSlotDisabled = (time: string) => {
    if (!selectedDate) return false;

    const [hours, minutes] = time.split(':').map(Number);
    const slotDate = new Date(selectedDate);
    slotDate.setHours(hours, minutes);

    const now = new Date();
    return slotDate < now;
  };

  // const isDayDisabled = (date: Date) => {
  //   if (disabledDays.includes(date.getDay())) return true;
  //   if (minDate && date < minDate) return true;
  //   if (maxDate && date > maxDate) return true;
  //   return false;
  // };

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <Label>
          {label}
          {required && <span className="text-blue-600 mr-1">*</span>}
        </Label>
      )}

      <div className="relative">
        <Input
          type="text"
          value={formatDisplayValue(value ?? null)}
          placeholder={placeholder}
          readOnly
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(true)}
          className={cn('cursor-pointer rounded-xl border-blue-100/50', error && 'border-red-300 focus:border-red-500')}
        />

        {/* Calendar icon */}
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
          <svg className="w-5 h-5 text-text-secondary/50" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* DateTime Picker Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]">
          <div className="bg-white rounded-2xl shadow-2xl border border-blue-100/30 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-blue-50">
                <h3 className="text-lg font-extrabold text-text-primary tracking-tight">בחר תאריך ושעה</h3>
                <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)} className="rounded-xl h-8 w-8 p-0">
                  ✕
                </Button>
              </div>

              {/* Date picker */}
              <div className="mb-6">
                <Label className="block mb-2">תאריך</Label>
                <Input
                  type="date"
                  value={formatDateForInput(selectedDate)}
                  onChange={(e) => handleDateChange(e.target.value)}
                  min={minDate ? formatDateForInput(minDate) : undefined}
                  max={maxDate ? formatDateForInput(maxDate) : undefined}
                />
              </div>

              {/* Time slots */}
              {selectedDate && (
                <div className="mb-6">
                  <Label className="block mb-2">שעה</Label>
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                    {timeSlots.map((time) => {
                      const isDisabled = isTimeSlotDisabled(time);
                      const isSelected = selectedTime === time;

                      return (
                        <button
                          key={time}
                          onClick={() => !isDisabled && handleTimeChange(time)}
                          disabled={isDisabled}
                          className={cn(
                            'p-2.5 text-sm rounded-xl border transition-all duration-200 font-bold',
                            isSelected
                              ? 'bg-primary text-on-dark border-primary shadow-sm scale-[1.02]'
                              : 'bg-blue-50 border-blue-200 text-blue-900 hover:bg-blue-50 hover:border-blue-200 hover:text-primary',
                            isDisabled && 'opacity-30 cursor-not-allowed bg-slate-50'
                          )}
                        >
                          {time}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  ביטול
                </Button>
                <Button onClick={() => setIsOpen(false)} disabled={!selectedDate}>
                  אישור
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Utility function to check if a time slot is available
export function isTimeSlotAvailable(
  date: Date,
  timeSlot: string,
  existingSlots: Date[] = []
): boolean {
  const [hours, minutes] = timeSlot.split(':').map(Number);
  const slotDate = new Date(date);
  slotDate.setHours(hours, minutes);

  // Check if it's in the past
  if (slotDate < new Date()) {
    return false;
  }

  // Check if slot is already taken
  return !existingSlots.some((existing) => existing.getTime() === slotDate.getTime());
}

// Hook for managing installation slots
export function useInstallationSlots() {
  const [availableSlots, setAvailableSlots] = useState<Date[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAvailableSlots = async (date: Date) => {
    setLoading(true);
    try {
      const response = await apiClient(`/api/calendar/availability?date=${date.toISOString()}`);
      const data = await response.json();

      if (data.success) {
        setAvailableSlots(data.data?.availableSlots?.map((slot: string) => new Date(slot)) || []);
      }
    } catch (error) {
      console.error('Failed to fetch available slots:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    availableSlots,
    loading,
    fetchAvailableSlots,
  };
}
