import React, { useEffect, useMemo, useRef } from 'react';
import { benchSvg } from '@/components/order-bench/art';
import { ControlledBench } from '@/components/order-bench/controlled-engine';
import { benchState, departureBlockers, stationStatuses } from './journey';
import { money, type DemoOrder } from './demo';
import { getStatusLabel } from '@/lib/orderStatus';

const SVG = benchSvg();

export function Bench({ order, compact = false }: { order: DemoOrder; compact?: boolean }) {
  const stage = useRef<HTMLDivElement>(null);
  const engine = useRef<ControlledBench | null>(null);
  const initial = useRef(benchState(order));
  const state = useMemo(() => benchState(order), [order]);
  useEffect(() => {
    if (!stage.current) return;
    engine.current = new ControlledBench(stage.current, initial.current);
    return () => engine.current?.dispose();
  }, []);
  useEffect(() => engine.current?.update(state), [state]);
  const missing = departureBlockers(order);
  return (
    <figure
      className={`bench ob-figure iso ${compact ? 'bench-compact' : ''}`}
      data-theme="light"
      data-status={order.status}
      data-gate={state.gateOpen ? 'open' : 'closed'}
      aria-label="המחשת ההזמנה הנבחרת"
    >
      <div className="bench-caption">
        <span>מסוע ההזמנות</span>
        <span>{getStatusLabel(order.status)}</span>
      </div>
      <div
        ref={stage}
        className="ob-svg"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: SVG }}
      />
      <div className="station-labels" aria-label="שלבי ההזמנה">
        {stationStatuses.map((status, n) => (
          <span key={status} aria-current={n === state.station ? 'step' : undefined}>
            {getStatusLabel(status)}
            {status === 'INSTALLATION' && <small>לפי הצורך</small>}
          </span>
        ))}
      </div>
      <figcaption>
        <strong>
          {state.held
            ? 'ההזמנה מושהית'
            : state.cancelled
              ? 'ההזמנה בוטלה'
              : state.gateOpen
                ? 'מחסום היציאה פתוח'
                : 'מחסום היציאה סגור'}
        </strong>
        <span>
          {money(order.paidAmountCents)} מתוך {money(order.totalCents)} ·{' '}
          {order.scheduledAt ? `אספקה: ${order.scheduledAt}` : 'טרם נקבע מועד'}
        </span>
        {!compact && (
          <p>
            הארגז הוא ההזמנה, התחנות הן שלבי העבודה והמטבעות מציגים את שיעור התשלום.{' '}
            {missing.length ? 'תשלום מלא ומועד אספקה נדרשים לפתיחת המחסום.' : 'תנאי היציאה הושלמו.'}
          </p>
        )}
      </figcaption>
    </figure>
  );
}
