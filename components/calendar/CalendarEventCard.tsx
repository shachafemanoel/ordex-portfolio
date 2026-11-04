export type CalendarEventVariant = 'blue' | 'orange' | 'green' | 'red' | 'purple';

export interface CalendarEventCardProps {
  event: {
    id: string;
    title: string;
    location?: string;
    startTime: string;
    endTime?: string;
    variant: CalendarEventVariant;
    orderNumber?: string;
  };
}

const variantClasses: Record<CalendarEventVariant, string> = {
  blue: 'bg-blue-50 border-blue-200 text-blue-900',
  orange: 'bg-blue-50 border-blue-200 text-blue-900',
  green: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  red: 'bg-red-50 border-red-200 text-red-900',
  purple: 'bg-violet-50 border-violet-200 text-violet-900',
};

export function CalendarEventCard({ event }: CalendarEventCardProps) {
  return (
    <div className={`rounded-2xl border p-3 ${variantClasses[event.variant]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{event.title}</div>
          {event.location ? (
            <div className="text-xs opacity-80 mt-1">{event.location}</div>
          ) : null}
          {event.orderNumber ? (
            <div className="text-xs opacity-70 mt-1">הזמנה #{event.orderNumber}</div>
          ) : null}
        </div>
        <div className="text-sm font-medium whitespace-nowrap">
          {event.startTime}
          {event.endTime ? ` - ${event.endTime}` : ''}
        </div>
      </div>
    </div>
  );
}
