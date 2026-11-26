import { ORDER_STATUS_LABELS } from '@cvetotishina/shared';
import type { OrderStatus } from '../types';
import { classNames, statusTone } from '../lib/format';

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={classNames('status-badge', `status-${statusTone(status)}`)}>{ORDER_STATUS_LABELS[status]}</span>;
}
