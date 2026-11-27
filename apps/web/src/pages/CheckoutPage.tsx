import { useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, CreditCard, LoaderCircle, LockKeyhole, Mail, MapPin, ShoppingBag, Store } from 'lucide-react';
import { formatMoney } from '@cvetotishina/shared';
import { Link, useNavigate } from 'react-router-dom';
import { DemoNotice } from '../components/DemoNotice';
import { EmptyState } from '../components/StateViews';
import { SmartImage } from '../components/SmartImage';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useStoreConfig } from '../hooks/useQueries';
import { createOrder, quoteCart } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { saveOrderToken } from '../lib/orderTokens';
import type { CreateOrderInput, DeliveryType } from '../types';

interface CheckoutForm {
  customerName: string;
  phone: string;
  email: string;
  deliveryType: DeliveryType;
  address: string;
  comment: string;
  utensils: boolean;
}

const initialForm: CheckoutForm = {
  customerName: '',
  phone: '',
  email: '',
  deliveryType: 'DELIVERY',
  address: '',
  comment: '',
  utensils: false,
};

const PHONE_PATTERN = /^\+?[0-9\s()-]{10,20}$/;

export function CheckoutPage() {
  useDocumentTitle('Оформление заказа');
  const { items, itemCount, clearCart } = useCart();
  const { showToast } = useToast();
  const config = useStoreConfig();
  const navigate = useNavigate();
  const [form, setForm] = useState<CheckoutForm>(initialForm);
  const [formError, setFormError] = useState<string | null>(null);
  const idempotency = useRef<{ signature: string; key: string } | null>(null);

  const quote = useQuery({
    queryKey: ['checkout-quote', items, form.deliveryType],
    queryFn: ({ signal }) => quoteCart(items, form.deliveryType, signal),
    enabled: items.length > 0,
    retry: 1,
  });

  const orderMutation = useMutation({
    mutationFn: (variables: { input: CreateOrderInput; key: string }) => createOrder(variables.input, variables.key),
    onSuccess: ({ order, accessToken }) => {
      saveOrderToken(order.number, accessToken);
      clearCart();
      showToast('Заказ создан. Открываем страницу заказа.', 'success');
      navigate(`/order/${encodeURIComponent(order.number)}`, { replace: true });
    },
    onError: (error) => setFormError(errorMessage(error, 'Не удалось создать заказ.')),
  });

  const updateField = <K extends keyof CheckoutForm>(key: K, value: CheckoutForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFormError(null);
  };

  const submitOrder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (orderMutation.isPending) return;
    const customerName = form.customerName.trim();
    const phone = form.phone.trim();
    const address = form.address.trim();
    if (!customerName) {
      setFormError('Укажите имя получателя.');
      return;
    }
    if (!PHONE_PATTERN.test(phone)) {
      setFormError('Проверьте номер телефона: используйте от 10 до 20 символов, цифры, пробелы, скобки, плюс и дефис.');
      return;
    }
    if (form.deliveryType === 'DELIVERY' && !address) {
      setFormError('Для доставки укажите адрес.');
      return;
    }
    if (!quote.data || quote.error) {
      setFormError('Дождитесь пересчёта корзины.');
      return;
    }

    const input: CreateOrderInput = {
      items,
      customerName,
      phone,
      email: form.email.trim() || undefined,
      deliveryType: form.deliveryType,
      address: form.deliveryType === 'DELIVERY' ? address : undefined,
      comment: form.comment.trim() || undefined,
      utensils: form.utensils,
    };
    const signature = JSON.stringify(input);
    if (idempotency.current?.signature !== signature) {
      idempotency.current = { signature, key: crypto.randomUUID() };
    }
    setFormError(null);
    orderMutation.mutate({ input, key: idempotency.current.key });
  };

  if (items.length === 0) {
    return (
      <section className="section checkout-page">
        <div className="container">
          <EmptyState title="Корзина пока пуста" description="Сначала выберите букет. После оформления заказа корзина автоматически очистится." />
        </div>
      </section>
    );
  }

  return (
    <section className="section checkout-page">
      <div className="container">
        <Link to="/catalog" className="back-link"><ArrowLeft size={16} aria-hidden="true" /> Продолжить выбор</Link>
        <div className="checkout-heading"><p className="eyebrow">Последний шаг</p><h1>Оформление <em>заказа</em></h1><p>Проверьте данные. Стоимость ниже рассчитана для выбранного способа получения.</p></div>
        <div className="checkout-grid">
          <form className="checkout-form surface-card" onSubmit={submitOrder}>
            <fieldset className="form-section">
              <legend><span>01</span> Получатель</legend>
              <div className="form-grid">
                <FormField label="Имя" required><input value={form.customerName} onChange={(event) => updateField('customerName', event.target.value)} autoComplete="name" placeholder="Как к вам обращаться" required maxLength={120} /></FormField>
                <FormField label="Телефон" required><input type="tel" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} autoComplete="tel" placeholder="Для связи по заказу" required maxLength={20} pattern="\+?[0-9\s\(\)\-]{10,20}" /></FormField>
                <FormField label="Email" hint="Необязательно" wide><input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} autoComplete="email" placeholder="name@example.ru" /></FormField>
              </div>
            </fieldset>
            <fieldset className="form-section">
              <legend><span>02</span> Получение</legend>
              <div className="delivery-options">
                <label className={form.deliveryType === 'PICKUP' ? 'delivery-option delivery-option-active' : 'delivery-option'}>
                  <input type="radio" name="deliveryType" value="PICKUP" checked={form.deliveryType === 'PICKUP'} onChange={() => updateField('deliveryType', 'PICKUP')} />
                  <Store size={23} aria-hidden="true" /><strong>Самовывоз</strong><span>Без доставки</span>
                </label>
                <label className={form.deliveryType === 'DELIVERY' ? 'delivery-option delivery-option-active' : 'delivery-option'}>
                  <input type="radio" name="deliveryType" value="DELIVERY" checked={form.deliveryType === 'DELIVERY'} onChange={() => updateField('deliveryType', 'DELIVERY')} />
                  <MapPin size={23} aria-hidden="true" /><strong>Доставка</strong><span>{config.data ? formatMoney(config.data.deliveryFee) : 'Тариф из настроек'}</span>
                </label>
              </div>
              {form.deliveryType === 'DELIVERY' && <FormField label="Адрес доставки" required><input value={form.address} onChange={(event) => updateField('address', event.target.value)} autoComplete="street-address" placeholder="Город, улица, дом, квартира" required maxLength={300} /></FormField>}
              {form.deliveryType === 'PICKUP' && <p className="form-hint"><Store size={16} aria-hidden="true" /> {config.data?.address ? `Самовывоз: ${config.data.address}` : 'Самовывоз из мастерской ежедневно с 09:00 до 21:00.'}</p>}
            </fieldset>
            <fieldset className="form-section">
              <legend><span>03</span> Детали</legend>
              <FormField label="Комментарий или текст для открытки" hint="Необязательно"><textarea value={form.comment} onChange={(event) => updateField('comment', event.target.value)} placeholder="Пожелания к букету, время вручения или слова для открытки" rows={4} maxLength={1000} /></FormField>
              <label className="checkbox-row"><input type="checkbox" checked={form.utensils} onChange={(event) => updateField('utensils', event.target.checked)} /><span><strong>Добавить открытку к букету</strong><small>Плотная хлопковая открытка с подписью от руки</small></span></label>
            </fieldset>
            <DemoNotice config={config.data} compact />
            {formError && <div className="form-error" role="alert">{formError}</div>}
            <button type="submit" className="button button-primary button-large button-full" disabled={orderMutation.isPending || quote.isFetching || !quote.data}>
              {orderMutation.isPending ? <><LoaderCircle className="spin" size={19} aria-hidden="true" /> Создаём заказ…</> : <>Создать заказ <ArrowRight size={19} aria-hidden="true" /></>}
            </button>
            <p className="secure-note"><LockKeyhole size={15} aria-hidden="true" /> Защита от повторной отправки заказа включена.</p>
          </form>

          <aside className="checkout-summary surface-card" aria-label="Состав и стоимость заказа">
            <div className="summary-heading"><h2>Ваш заказ</h2><span>{itemCount}</span></div>
            {quote.isLoading ? (
              <div className="summary-loading" role="status"><div className="skeleton skeleton-cart-item" /><div className="skeleton skeleton-cart-item" /><p>Пересчитываем стоимость…</p></div>
            ) : quote.error ? (
              <div className="summary-error" role="alert"><h3>Не удалось пересчитать заказ</h3><p>{errorMessage(quote.error)}</p><button type="button" className="button button-secondary" onClick={() => void quote.refetch()}>Повторить</button></div>
            ) : quote.data ? (
              <>
                <div className="summary-items">
                  {quote.data.items.map((item) => (
                    <div className="summary-item" key={item.productId}>
                      <SmartImage src={item.imageUrl} alt="" loading="lazy" />
                      <div><strong>{item.name}</strong><span>{item.quantity} × {formatMoney(item.unitPrice)}</span></div>
                      <b>{formatMoney(item.lineTotal)}</b>
                    </div>
                  ))}
                </div>
                <dl className="totals">
                  <div><dt>Букеты</dt><dd>{formatMoney(quote.data.subtotal)}</dd></div>
                  <div><dt>{form.deliveryType === 'PICKUP' ? 'Самовывоз' : 'Доставка'}</dt><dd>{quote.data.deliveryFee === 0 ? 'Бесплатно' : formatMoney(quote.data.deliveryFee)}</dd></div>
                  {quote.data.serviceFee > 0 && <div><dt>Сервисный сбор</dt><dd>{formatMoney(quote.data.serviceFee)}</dd></div>}
                  <div className="totals-final"><dt>Итого</dt><dd>{formatMoney(quote.data.total)}</dd></div>
                </dl>
                <div className="demo-payment-card"><CreditCard size={22} aria-hidden="true" /><div><strong>Оплата заказа</strong><p>Подтверждение оплаты будет доступно на странице созданного заказа.</p></div></div>
                <ul className="purchase-notes"><li><Check size={16} aria-hidden="true" /> Итог подтверждён</li><li><ShoppingBag size={16} aria-hidden="true" /> Корзина очистится после создания</li><li><Mail size={16} aria-hidden="true" /> Открытка: {form.utensils ? 'добавим к букету' : 'не нужна'}</li></ul>
              </>
            ) : null}
          </aside>
        </div>
      </div>
    </section>
  );
}

function FormField({
  label,
  required = false,
  hint,
  wide = false,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`form-field ${wide ? 'form-field-wide' : ''}`}>
      <span className="form-field-label">{label}{required && <span aria-hidden="true"> *</span>}{hint && <small>{hint}</small>}</span>
      {children}
    </label>
  );
}
