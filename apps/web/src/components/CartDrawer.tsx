import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ShoppingBag, Trash2, Truck, X } from 'lucide-react';
import { formatMoney } from '@cvetotishina/shared';
import { Link } from 'react-router-dom';
import { MAX_CART_QUANTITY, useCart } from '../context/CartContext';
import { useStoreConfig } from '../hooks/useQueries';
import { quoteCart } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { QuantityControl } from './QuantityControl';
import { SmartImage } from './SmartImage';

function useCartQuote(enabled: boolean) {
  const { items } = useCart();
  return useQuery({
    queryKey: ['cart-quote', items, 'DELIVERY'],
    queryFn: ({ signal }) => quoteCart(items, 'DELIVERY', signal),
    enabled: enabled && items.length > 0,
    retry: 1,
  });
}

export function CartDrawer() {
  const { items, itemCount, isDrawerOpen, closeDrawer, setQuantity, removeItem, clearCart } = useCart();
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const quote = useCartQuote(isDrawerOpen);
  const config = useStoreConfig();

  useEffect(() => {
    if (!isDrawerOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const backgroundElements = [...document.querySelectorAll<HTMLElement>('.site-header, #main-content, .site-footer, .mobile-cart-bar')];
    const previousInert = backgroundElements.map((element) => ({ element, inert: element.inert }));
    backgroundElements.forEach((element) => { element.inert = true; });
    document.body.style.overflow = 'hidden';
    const frame = requestAnimationFrame(() => closeButtonRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDrawer();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
      )];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousInert.forEach(({ element, inert }) => { element.inert = inert; });
      previousFocus?.focus();
    };
  }, [isDrawerOpen, closeDrawer]);

  const freeDeliveryRemaining =
    config.data && quote.data?.deliveryFee
      ? Math.max(0, config.data.freeDeliveryFrom - quote.data.subtotal)
      : 0;

  return (
    <div className={`drawer-root ${isDrawerOpen ? 'drawer-root-open' : ''}`} aria-hidden={!isDrawerOpen} inert={!isDrawerOpen}>
      <button type="button" className="drawer-backdrop" onClick={closeDrawer} aria-label="Закрыть корзину" tabIndex={-1} />
      <aside
        ref={panelRef}
        className="cart-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
      >
        <div className="drawer-header">
          <div>
            <p className="eyebrow">Ваш выбор</p>
            <h2 id="cart-drawer-title">Корзина <span>{itemCount}</span></h2>
          </div>
          <button ref={closeButtonRef} type="button" className="icon-button icon-button-large" onClick={closeDrawer} aria-label="Закрыть корзину">
            <X size={22} aria-hidden="true" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="drawer-empty">
            <span className="state-icon"><ShoppingBag size={29} aria-hidden="true" /></span>
            <h3>Пока без букетов</h3>
            <p>Выберите что-нибудь красивое — мы сохраним корзину на этом устройстве.</p>
            <Link to="/catalog" className="button button-primary" onClick={closeDrawer}>Выбрать букет <ArrowRight size={17} aria-hidden="true" /></Link>
          </div>
        ) : quote.isLoading ? (
          <div className="drawer-loading" role="status">
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-cart-item" />
            <div className="skeleton skeleton-cart-item" />
            <p>Пересчитываем состав и стоимость…</p>
          </div>
        ) : (
          <>
            <div className="drawer-items">
              {quote.error && (
                <div className="drawer-error" role="alert">
                  <h3>Не удалось пересчитать корзину</h3>
                  <p>{errorMessage(quote.error)}</p>
                  <div className="state-actions">
                    <button type="button" className="button button-secondary" onClick={() => void quote.refetch()}>Попробовать снова</button>
                    <button type="button" className="button button-ghost" onClick={clearCart}>Очистить корзину</button>
                  </div>
                </div>
              )}
              {items.map((line) => {
                const item = quote.data?.items.find((quotedItem) => quotedItem.productId === line.productId);
                const name = item?.name ?? 'Товар в корзине';
                return (
                  <article className="cart-line" key={line.productId}>
                    {item ? (
                      <Link to="/catalog" className="cart-line-image" onClick={closeDrawer} aria-label="Перейти в каталог">
                        <SmartImage src={item.imageUrl} alt={item.name} loading="lazy" />
                      </Link>
                    ) : (
                      <div className="cart-line-image" aria-hidden="true"><ShoppingBag size={24} /></div>
                    )}
                    <div className="cart-line-content">
                      <div className="cart-line-top">
                        <h3>{name}</h3>
                        <button type="button" className="icon-button" onClick={() => removeItem(line.productId)} aria-label={`Удалить ${name}`}>
                          <Trash2 size={17} aria-hidden="true" />
                        </button>
                      </div>
                      {item && <p>{formatMoney(item.unitPrice)} за букет</p>}
                      <div className="cart-line-bottom">
                        <QuantityControl
                          compact
                          value={line.quantity}
                          max={item ? Math.max(1, Math.min(item.stock, MAX_CART_QUANTITY)) : MAX_CART_QUANTITY}
                          onChange={(quantity) => setQuantity(line.productId, quantity)}
                          label={`Количество ${name}`}
                        />
                        <strong>{item ? formatMoney(item.lineTotal) : `${line.quantity} шт.`}</strong>
                      </div>
                      {item && item.quantity > item.stock && <p className="field-error">На складе доступно: {item.stock}</p>}
                    </div>
                  </article>
                );
              })}
            </div>
            {quote.data && !quote.error && (
              <div className="drawer-footer">
                {freeDeliveryRemaining > 0 && config.data && (
                  <p className="delivery-hint"><Truck size={17} aria-hidden="true" /> До бесплатной доставки — {formatMoney(freeDeliveryRemaining)}</p>
                )}
                <dl className="totals">
                  <div><dt>Букеты</dt><dd>{formatMoney(quote.data.subtotal)}</dd></div>
                  <div><dt>Доставка</dt><dd>{quote.data.deliveryFee === 0 ? 'Бесплатно' : formatMoney(quote.data.deliveryFee)}</dd></div>
                  {quote.data.serviceFee > 0 && <div><dt>Сервисный сбор</dt><dd>{formatMoney(quote.data.serviceFee)}</dd></div>}
                  <div className="totals-final"><dt>Итого</dt><dd>{formatMoney(quote.data.total)}</dd></div>
                </dl>
                <Link to="/checkout" className="button button-primary button-full" onClick={closeDrawer}>
                  Оформить заказ <ArrowRight size={18} aria-hidden="true" />
                </Link>
                <p className="drawer-demo-note">Стоимость пересчитывается перед оформлением.</p>
              </div>
            )}
          </>
        )}
      </aside>
    </div>
  );
}

export function MobileCartBar() {
  const { items, itemCount, openDrawer } = useCart();
  const quote = useCartQuote(items.length > 0);
  if (itemCount === 0) return null;

  return (
    <div className="mobile-cart-bar">
      <button type="button" onClick={openDrawer} className="mobile-cart-button" aria-label={`Открыть корзину, товаров: ${itemCount}`}>
        <span className="mobile-cart-count">{itemCount}</span>
        <span><strong>Корзина</strong><small>{quote.data ? formatMoney(quote.data.total) : quote.error ? 'Не удалось пересчитать' : 'Пересчитываем…'}</small></span>
        <ArrowRight size={20} aria-hidden="true" />
      </button>
    </div>
  );
}
