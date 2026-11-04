import { CalendarEventCard, type CalendarEventVariant } from '@/components/calendar/CalendarEventCard';

export interface CalendarDayViewProps {
  date: Date;
  className?: string;
  events: Array<{
    id: string;
    title: string;
    location?: string;
    startTime: string;
    endTime?: string;
    variant: CalendarEventVariant;
    orderNumber?: string;
    orderId?: string;
  }>;
}

export function CalendarDayView({ date, events, className }: CalendarDayViewProps) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold text-gray-900">
          {date.toLocaleDateString('he-IL', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </div>
        <div className="text-xs text-gray-500">{events.length} אירועים</div>
      </div>
      <div className="space-y-3">
        {events.map((event) => (
          <CalendarEventCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}
