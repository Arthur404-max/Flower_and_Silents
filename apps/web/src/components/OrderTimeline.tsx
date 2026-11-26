import { Check, Circle } from 'lucide-react';
import { ORDER_STATUS_LABELS } from '@cvetotishina/shared';
import type { OrderView } from '../types';
import { classNames, formatDateTime } from '../lib/format';

export function OrderTimeline({ order }: { order: OrderView }) {
  return (
    <ol className="order-timeline" aria-label="История статуса заказа">
      {order.history.map((entry, index) => {
        const isCurrent = index === order.history.length - 1;
        const isDone = !isCurrent;
        return (
          <li key={entry.id ?? `${entry.createdAt}-${index}`} className={classNames(isCurrent && 'timeline-current', isDone && 'timeline-done')} aria-current={isCurrent ? 'step' : undefined}>
            <span className="timeline-marker">{isDone ? <Check size={15} aria-hidden="true" /> : <Circle size={13} fill="currentColor" aria-hidden="true" />}</span>
            <div>
              <strong>{ORDER_STATUS_LABELS[entry.toStatus]}</strong>
              {entry.comment && <p>{entry.comment}</p>}
              <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
