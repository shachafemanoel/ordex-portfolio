'use client';

import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Calendar, CheckCircle, Clock, FileText, Loader2, Truck, User } from 'lucide-react';
import { useEffect, useState } from 'react';

interface OpsTimelineEvent {
  id: string;
  at: string;
  stage: string;
  type: string;
  title: string;
  description?: string;
  actorName?: string;
  metadata?: any;
}

interface AuditTimelineProps {
  orderId: string;
  className?: string;
}

export function AuditTimeline({ orderId, className }: AuditTimelineProps) {
  const [events, setEvents] = useState<OpsTimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function fetchTimeline() {
      try {
        const res = await fetch(`/api/orders/${orderId}/timeline`);
        if (!res.ok) throw new Error('Failed to load timeline');
        const data = await res.json();
        if (mounted) {
           // data.data.events or data.events depending on response wrapper
           const eventList = data.data?.events || data.events || [];
           setEvents(eventList);
        }
      } catch (err) {
        if (mounted) setError('Failed to load timeline');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchTimeline();
    return () => { mounted = false; };
  }, [orderId]);

  if (loading) return <div className="flex justify-center p-4"><Loader2 className="h-5 w-5 animate-spin text-fg-subtle" /></div>;
  if (error) return <div className="text-center text-sm text-danger p-4">{error}</div>;
  if (events.length === 0) return <div className="text-center text-sm text-fg-subtle p-4">אין פעילות מתועדת</div>;

  return (
    <div className={cn("space-y-4 px-2", className)} dir="rtl">
       {events.map((event, idx) => (
          <div key={event.id} className="flex gap-3 relative">
             {/* Line */}
             {idx < events.length - 1 && (
               <div className="absolute top-8 bottom-[-16px] right-[15px] w-px bg-divider" />
             )}

             {/* Icon */}
             <div className="flex-shrink-0 mt-1 h-8 w-8 rounded-full bg-surface-highlight flex items-center justify-center text-fg-muted z-10 border border-subtle ring-2 ring-[var(--color-neutral-50)]">
                {getEventIcon(event.type)}
             </div>

             {/* Content */}
             <div className="flex-1 pb-4">
                <div className="flex items-start justify-between">
                   <p className="text-sm font-medium text-fg">{event.title}</p>
                   <span className="text-[10px] text-fg-subtle whitespace-nowrap ml-2">
                     {format(new Date(event.at), 'dd/MM HH:mm')}
                   </span>
                </div>
                {event.description && (
                  <p className="text-xs text-fg-muted mt-0.5">{event.description}</p>
                )}
                <div className="flex items-center gap-2 mt-1.5">
                   {event.actorName && (
                     <div className="flex items-center gap-1 text-[10px] text-fg-subtle">
                        <User className="h-3 w-3" />
                        <span>{event.actorName}</span>
                     </div>
                   )}
                   <Badge variant="secondary" className="text-[9px] h-4 px-1 font-normal bg-surface-highlight text-fg-muted hover:bg-neutral-mute">
                      {event.stage}
                   </Badge>
                </div>
             </div>
          </div>
       ))}
    </div>
  );
}

function getEventIcon(type: string) {
  switch (type) {
    case 'STATUS_CHANGE': return <CheckCircle className="h-4 w-4 text-success" />;
    case 'PURCHASE_ORDER': return <FileText className="h-4 w-4 text-warning" />;
    case 'SCHEDULE': return <Calendar className="h-4 w-4 text-warning" />;
    case 'ALLOCATION': return <Truck className="h-4 w-4 text-brand" />;
    default: return <Clock className="h-4 w-4" />;
  }
}
