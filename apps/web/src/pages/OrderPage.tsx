import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, CreditCard, LoaderCircle, LockKeyhole, MapPin, PackageCheck, RefreshCw, Store } from 'lucide-react';
import { formatMoney } from '@cvetotishina/shared';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { DemoNotice } from '../components/DemoNotice';
import { OrderTimeline } from '../components/OrderTimeline';
import { PageLoader } from '../components/StateViews';
import { StatusBadge } from '../components/StatusBadge';
import { SmartImage } from '../components/SmartImage';
import { useToast } from '../context/ToastContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useStoreConfig } from '../hooks/useQueries';
import { ApiError, getOrder, payDemoOrder } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { formatDate, formatDateTime } from '../lib/format';
import { getOrderToken, saveOrderToken } from '../lib/orderTokens';
import type { OrderView } from '../types';

const paymentLabels: Record<OrderView['paymentStatus'], string> = {
  PENDING: 'Ожидает оплаты',
  PAID: 'Оплачено',
  FAILED: 'Оплата не прошла',
  REFUNDED: 'Возврат средств',
};

export function OrderPage() {
  const { number = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryToken = searchParams.get('token');
  const [access, setAccess] = useState<{ number: string; token: string | null }>(() => ({
    number,
    token: queryToken ?? getOrderToken(number),
  }));
  const token = access.number === number ? access.token : queryToken ?? getOrderToken(number);
  const paymentKey = useRef<string | null>(null);
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const config = useStoreConfig();
  useDocumentTitle(`Заказ ${number}`);

  useEffect(() => {
    if (queryToken) {
      saveOrderToken(number, queryToken);
      setAccess({ number, token: queryToken });
      const next = new URLSearchParams(searchParams);
      next.delete('token');
      setSearchParams(next, { replace: true });
    } else if (access.number !== number) {
      setAccess({ number, token: getOrderToken(number) });
    }
  }, [number, queryToken, searchParams, setSearchParams, access.number]);

  const orderQuery = useQuery({
    queryKey: ['order', number, token],
    queryFn: ({ signal }) => getOrder(number, token ?? '', signal),
    enabled: Boolean(token),
    retry: false,
    refetchOnWindowFocus: true,
  });
  const order = orderQuery.data?.order;

  const paymentMutation = useMutation({
    mutationFn: () => payDemoOrder(number, token ?? '', paymentKey.current ?? crypto.randomUUID()),
    onSuccess: ({ order: paidOrder }) => {
      queryClient.setQueryData(['order', number, token], { order: paidOrder });
      paymentKey.current = null;
      showToast('Оплата прошла. Статус заказа обновлён.', 'success');
    },
    onError: (error) => showToast(errorMessage(error, 'Не удалось провести оплату.'), 'error'),
  });

  const pay = () => {
    if (!token || paymentMutation.isPending) return;
    paymentKey.current ??= crypto.randomUUID();
    paymentMutation.mutate();
  };

  if (!token) {
    return (
      <section className="section order-page">
        <div className="container">
          <div className="state-card access-state">
            <span className="state-icon"><LockKeyhole size={28} aria-hidden="true" /></span>
            <h1>Нужна ссылка доступа</h1>
            <p>Одноразовый токен заказа сохраняется на устройстве после оформления. На этом устройстве доступ не найден.</p>
            <p className="muted-copy">Не отправляйте токен другим людям и не публикуйте его в ссылках.</p>
            <Link to="/" className="button button-secondary"><ArrowLeft size={17} aria-hidden="true" /> На главную</Link>
          </div>
        </div>
      </section>
    );
  }

  if (orderQuery.isLoading) return <PageLoader label="Открываем ваш заказ…" />;

  if (orderQuery.error) {
    const accessError = orderQuery.error instanceof ApiError && [401, 403, 404].includes(orderQuery.error.status);
    return (
      <section className="section order-page">
        <div className="container">
          <div className="state-card state-error access-state" role="alert">
            <span className="state-icon"><LockKeyhole size={28} aria-hidden="true" /></span>
            <h1>{accessError ? 'Заказ недоступен' : 'Не удалось открыть заказ'}</h1>
            <p>{errorMessage(orderQuery.error)}</p>
            {accessError && <p className="muted-copy">Проверьте номер заказа. Доступ хранится локально и не отображается в интерфейсе.</p>}
            <div className="state-actions"><button type="button" className="button button-secondary" onClick={() => void orderQuery.refetch()}><RefreshCw size={17} aria-hidden="true" /> Повторить</button><Link to="/" className="button button-ghost">На главную</Link></div>
          </div>
        </div>
      </section>
    );
  }

  if (!order) return null;

  const showPayment =
    (order.status === 'AWAITING_PAYMENT' || order.status === 'PAYMENT_FAILED') &&
    (order.paymentStatus === 'PENDING' || order.paymentStatus === 'FAILED');

  return (
    <section className="section order-page">
      <div className="container">
        <Link to="/" className="back-link"><ArrowLeft size={16} aria-hidden="true" /> На главную</Link>
        <div className="order-heading">
          <div><p className="eyebrow">Заказ {order.number}</p><h1>{order.status === 'DELIVERED' ? 'Букет у вас' : 'Ваш заказ'}</h1><p>Создан {formatDateTime(order.createdAt)}</p></div>
          <div className="order-heading-actions"><StatusBadge status={order.status} /><button type="button" className="button button-secondary" onClick={() => void orderQuery.refetch()} disabled={orderQuery.isFetching}><RefreshCw size={17} className={orderQuery.isFetching ? 'spin' : ''} aria-hidden="true" /> Обновить</button></div>
        </div>
        <DemoNotice config={config.data} compact />
        {showPayment && (
          <div className="payment-banner">
            <span className="payment-banner-icon"><CreditCard size={26} aria-hidden="true" /></span>
            <div><h2>{order.status === 'PAYMENT_FAILED' ? 'Повторите оплату' : 'Оплата заказа'}</h2><p>{order.status === 'PAYMENT_FAILED' ? 'Предыдущая оплата не прошла. Можно попробовать ещё раз.' : 'Проверьте детали и перейдите к подтверждению оплаты.'}</p></div>
            <button type="button" className="button button-primary" onClick={pay} disabled={paymentMutation.isPending}>{paymentMutation.isPending ? <><LoaderCircle size={18} className="spin" aria-hidden="true" /> Проверяем…</> : <>{order.status === 'PAYMENT_FAILED' ? 'Повторить оплату' : 'Оплата заказа'} · {formatMoney(order.total)} <ArrowRight size={17} aria-hidden="true" /></>}</button>
          </div>
        )}
        {paymentMutation.error && <div className="form-error" role="alert">{errorMessage(paymentMutation.error)}</div>}
        <div className="order-grid">
          <div className="order-main">
            <section className="surface-card order-card">
              <div className="card-heading"><div><p className="eyebrow">Движение заказа</p><h2>Статус и история</h2></div><span className="payment-label">{paymentLabels[order.paymentStatus]}</span></div>
              {order.status === 'CANCELLED' && <div className="order-status-message status-danger">Заказ отменён. Дальнейшие шаги не выполняются.</div>}
              {order.status === 'PAYMENT_FAILED' && <div className="order-status-message status-warning">Оплата не прошла. Вы можете повторить попытку.</div>}
              <OrderTimeline order={order} />
            </section>
            <section className="surface-card order-card">
              <div className="card-heading"><div><p className="eyebrow">Что внутри</p><h2>Состав заказа</h2></div><PackageCheck size={24} aria-hidden="true" /></div>
              <div className="order-items">
                {order.items.map((item) => (
                  <article className="order-item" key={item.id}>
                    <SmartImage src={item.imageUrl} alt={item.name} loading="lazy" />
                    <div><h3>{item.name}</h3><p>{item.quantity} × {formatMoney(item.unitPrice)}</p></div>
                    <strong>{formatMoney(item.lineTotal)}</strong>
                  </article>
                ))}
              </div>
            </section>
          </div>
          <aside className="order-sidebar">
            <section className="surface-card order-card">
              <div className="card-heading"><h2>Получение</h2>{order.deliveryType === 'PICKUP' ? <Store size={22} aria-hidden="true" /> : <MapPin size={22} aria-hidden="true" />}</div>
              <dl className="order-info-list">
                <div><dt>Получатель</dt><dd>{order.customerName}</dd></div>
                <div><dt>Телефон</dt><dd>{order.phone}</dd></div>
                {order.email && <div><dt>Email</dt><dd>{order.email}</dd></div>}
                <div><dt>Способ</dt><dd>{order.deliveryType === 'PICKUP' ? 'Самовывоз' : 'Доставка'}</dd></div>
                {order.address && <div><dt>Адрес</dt><dd>{order.address}</dd></div>}
                <div><dt>Открытка</dt><dd>{order.utensils ? 'Добавим к букету' : 'Не нужна'}</dd></div>
                {order.comment && <div><dt>Комментарий</dt><dd>{order.comment}</dd></div>}
                {order.paidAt && <div><dt>Дата оплаты</dt><dd>{formatDate(order.paidAt)}</dd></div>}
              </dl>
            </section>
            <section className="surface-card order-card">
              <h2>Суммы</h2>
              <dl className="totals">
                <div><dt>Букеты</dt><dd>{formatMoney(order.subtotal)}</dd></div>
                <div><dt>Доставка</dt><dd>{order.deliveryFee === 0 ? 'Бесплатно' : formatMoney(order.deliveryFee)}</dd></div>
                {order.serviceFee > 0 && <div><dt>Сервисный сбор</dt><dd>{formatMoney(order.serviceFee)}</dd></div>}
                <div className="totals-final"><dt>Итого</dt><dd>{formatMoney(order.total)}</dd></div>
              </dl>
            </section>
            <p className="access-footnote"><LockKeyhole size={15} aria-hidden="true" /> Токен доступа скрыт и хранится только в этом браузере.</p>
          </aside>
        </div>
      </div>
    </section>
  );
}
