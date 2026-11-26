import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, ClipboardList, LoaderCircle, MapPin, RefreshCw, Store } from 'lucide-react';
import { formatMoney } from '@cvetotishina/shared';
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from '@cvetotishina/shared';
import { Link, useParams } from 'react-router-dom';
import { StatusBadge } from '../../components/StatusBadge';
import { SmartImage } from '../../components/SmartImage';
import { ErrorState } from '../../components/StateViews';
import { useToast } from '../../context/ToastContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { ApiError, getAdminOrder, updateAdminOrderStatus } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { formatDateTime } from '../../lib/format';
import type { OrderStatus } from '../../types';

export function AdminOrderDetailPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const orderQuery = useQuery({ queryKey: ['admin', 'order', id], queryFn: ({ signal }) => getAdminOrder(id, signal), retry: 1 });
  const order = orderQuery.data;
  useDocumentTitle(order ? `Заказ ${order.number}` : 'Заказ');
  const [nextStatus, setNextStatus] = useState<OrderStatus>(order?.status ?? 'NEW');
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (order) setNextStatus(order.status);
  }, [order?.id, order?.status, order?.version]);

  const changeStatus = useMutation({
    mutationFn: () => updateAdminOrderStatus(id, order?.version ?? 0, nextStatus, comment),
    onSuccess: (updated) => {
      queryClient.setQueryData(['admin', 'order', id], updated);
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      setComment('');
      showToast('Статус заказа обновлён.', 'success');
    },
    onError: (error) => {
      showToast(errorMessage(error, 'Не удалось изменить статус.'), 'error');
      if (error instanceof ApiError && [409, 412].includes(error.status)) void orderQuery.refetch();
    },
  });

  if (orderQuery.isLoading) return <div className="admin-loading-block" role="status">Открываем заказ…</div>;
  if (orderQuery.error) return <ErrorState error={orderQuery.error} title="Не удалось открыть заказ" onRetry={() => void orderQuery.refetch()} />;
  if (!order) return null;

  return (
    <div className="admin-page">
      <Link to="/admin/orders" className="back-link"><ArrowLeft size={16} /> Все заказы</Link>
      <header className="admin-page-header admin-order-detail-header"><div><p className="eyebrow">Заказ {order.number}</p><h1>{order.customerName}</h1><p>Создан {formatDateTime(order.createdAt)} · версия {order.version}</p></div><div className="order-heading-actions"><StatusBadge status={order.status} /><button type="button" className="button button-secondary" onClick={() => void orderQuery.refetch()} disabled={orderQuery.isFetching}><RefreshCw size={17} className={orderQuery.isFetching ? 'spin' : ''} /> Обновить</button></div></header>
      <div className="admin-order-detail-grid">
        <div className="admin-order-main">
          <section className="admin-panel"><div className="admin-panel-heading"><div><h2>Состав заказа</h2><p>Суммы в копейках, отображаются в рублях</p></div><ClipboardList size={22} /></div><div className="admin-order-items">{order.items.map((item) => <article className="order-item" key={item.id}><SmartImage src={item.imageUrl} alt="" loading="lazy" /><div><h3>{item.name}</h3><p>{item.quantity} × {formatMoney(item.unitPrice)}</p></div><strong>{formatMoney(item.lineTotal)}</strong></article>)}</div><dl className="totals"><div><dt>Букеты</dt><dd>{formatMoney(order.subtotal)}</dd></div><div><dt>Доставка</dt><dd>{order.deliveryFee === 0 ? 'Бесплатно' : formatMoney(order.deliveryFee)}</dd></div>{order.serviceFee > 0 && <div><dt>Сервисный сбор</dt><dd>{formatMoney(order.serviceFee)}</dd></div>}<div className="totals-final"><dt>Итого</dt><dd>{formatMoney(order.total)}</dd></div></dl></section>
          <section className="admin-panel"><div className="admin-panel-heading"><div><h2>История</h2><p>Изменения, возвращённые API</p></div></div>{order.history?.length ? <ol className="admin-history">{[...order.history].reverse().map((entry, index) => <li key={entry.id ?? `${entry.createdAt}-${index}`}><span className="history-dot" /><div><div><StatusBadge status={entry.toStatus} /><time>{formatDateTime(entry.createdAt)}</time></div>{entry.comment && <p>{entry.comment}</p>}</div></li>)}</ol> : <div className="admin-empty-compact">История изменений пока пуста.</div>}</section>
        </div>
        <aside className="admin-order-sidebar">
          <section className="admin-panel"><div className="admin-panel-heading"><h2>Получатель</h2>{order.deliveryType === 'PICKUP' ? <Store size={21} /> : <MapPin size={21} />}</div><dl className="order-info-list"><div><dt>Имя</dt><dd>{order.customerName}</dd></div><div><dt>Телефон</dt><dd>{order.phone}</dd></div>{order.email && <div><dt>Email</dt><dd>{order.email}</dd></div>}<div><dt>Получение</dt><dd>{order.deliveryType === 'PICKUP' ? 'Самовывоз' : 'Демо-доставка'}</dd></div>{order.address && <div><dt>Адрес</dt><dd>{order.address}</dd></div>}<div><dt>Приборы</dt><dd>{order.utensils ? 'Нужны' : 'Не нужны'}</dd></div>{order.comment && <div><dt>Комментарий</dt><dd>{order.comment}</dd></div>}<div><dt>Оплата</dt><dd>{order.paymentStatus}</dd></div></dl></section>
          <section className="admin-panel admin-status-editor"><div className="admin-panel-heading"><h2>Изменить статус</h2></div><label className="form-field"><span className="form-field-label">Новый статус</span><select value={nextStatus} onChange={(event) => setNextStatus(event.target.value as OrderStatus)}>{ORDER_STATUSES.map((status) => <option key={status} value={status}>{ORDER_STATUS_LABELS[status]}</option>)}</select></label><label className="form-field"><span className="form-field-label">Комментарий</span><textarea rows={3} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Необязательно" /></label><p className="form-hint">Будет отправлен <code>If-Match: {order.version}</code> и CSRF-токен.</p><button type="button" className="button button-primary button-full" disabled={nextStatus === order.status || changeStatus.isPending} onClick={() => changeStatus.mutate()}>{changeStatus.isPending ? <><LoaderCircle className="spin" size={17} /> Сохраняем…</> : <><Check size={17} /> Применить статус</>}</button></section>
        </aside>
      </div>
    </div>
  );
}
