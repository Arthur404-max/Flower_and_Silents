import { ArrowUpRight } from 'lucide-react';
import { formatMoney } from '@cvetotishina/shared';
import { Link } from 'react-router-dom';
import type { AdminOrder } from '../../types';
import { formatDate } from '../../lib/format';
import { StatusBadge } from '../StatusBadge';

export function AdminOrderTable({ orders }: { orders: AdminOrder[] }) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table admin-orders-table">
        <thead><tr><th>Заказ</th><th>Получатель</th><th>Создан</th><th>Статус</th><th>Сумма</th><th><span className="sr-only">Открыть</span></th></tr></thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td><Link to={`/admin/orders/${encodeURIComponent(order.id)}`} className="admin-order-number">{order.number}</Link></td>
              <td><strong>{order.customerName}</strong><span className="table-secondary">{order.phone}</span></td>
              <td>{formatDate(order.createdAt)}</td>
              <td><StatusBadge status={order.status} /></td>
              <td><strong>{formatMoney(order.total)}</strong></td>
              <td><Link to={`/admin/orders/${encodeURIComponent(order.id)}`} className="icon-button" aria-label={`Открыть заказ ${order.number}`}><ArrowUpRight size={18} /></Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
