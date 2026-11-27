import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { formatMoney } from '@cvetotishina/shared';
import { ArrowRight, LockKeyhole, MapPin, Menu, Phone, Search, ShoppingBag, X } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useStoreConfig } from '../hooks/useQueries';
import { Logo } from './Logo';
import { CartDrawer, MobileCartBar } from './CartDrawer';

export function StoreLayout() {
  const { itemCount, openDrawer } = useCart();
  const config = useStoreConfig();
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  useEffect(() => {
    setSearch(location.pathname === '/catalog' ? new URLSearchParams(location.search).get('q') ?? '' : '');
  }, [location.pathname, location.search]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = search.trim();
    navigate(query ? `/catalog?q=${encodeURIComponent(query)}` : '/catalog');
  };

  const freeDeliveryLabel = config.data
    ? `Бесплатная доставка от ${formatMoney(config.data.freeDeliveryFrom)}`
    : 'Бережная доставка букетов';

  return (
    <div className="storefront-shell">
      <a href="#main-content" className="skip-link">Перейти к содержимому</a>
      <div className="utility-strip">
        <div className="container utility-strip-inner">
          <span>{freeDeliveryLabel}</span>
          <span className="utility-strip-sep" aria-hidden="true">·</span>
          <span className="utility-strip-detail">Самовывоз и курьерская доставка ежедневно</span>
        </div>
      </div>
      <header className="site-header">
        <div className="container header-main">
          <div className="brand-lockup">
            <Logo />
          </div>
          <nav className={`main-nav ${menuOpen ? 'main-nav-open' : ''}`} aria-label="Основная навигация">
            <NavLink to="/" end>Главная</NavLink>
            <NavLink to="/catalog">Каталог</NavLink>
            <NavLink to="/how-it-works">Как это работает</NavLink>
          </nav>
          <form className="header-search" role="search" onSubmit={submitSearch}>
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Найти букет…"
              aria-label="Поиск по каталогу"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} aria-label="Очистить поиск">
                <X size={15} aria-hidden="true" />
              </button>
            )}
          </form>
          <div className="header-actions">
            <Link to={itemCount > 0 ? '/checkout' : '/catalog'} className="button button-primary header-order">
              Заказать <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <button
              type="button"
              className="cart-button"
              onClick={openDrawer}
              aria-label={`Открыть корзину, товаров: ${itemCount}`}
            >
              <ShoppingBag size={19} strokeWidth={1.7} aria-hidden="true" />
              {itemCount > 0 && <span>{itemCount > 99 ? '99+' : itemCount}</span>}
            </button>
            <button
              type="button"
              className="menu-button icon-button"
              onClick={() => setMenuOpen((value) => !value)}
              aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </div>
        <form className="container mobile-search" role="search" onSubmit={submitSearch}>
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Найти букет…"
            aria-label="Поиск по каталогу"
          />
          <button type="submit" className="icon-button" aria-label="Найти">
            <ArrowRight size={17} />
          </button>
        </form>
      </header>
      <main id="main-content">
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container footer-top">
          <div className="footer-brand">
            <Logo />
            <p className="footer-tagline">Цветы, после которых становится тише.</p>
            <span className="footer-note">Авторская флористическая мастерская. Собираем букеты вручную из сезонных цветов.</span>
          </div>
          <div className="footer-links">
            <p className="footer-label">Мастерская</p>
            <Link to="/catalog">Все букеты</Link>
            <Link to="/how-it-works">Как это работает</Link>
            <Link to="/checkout">Оформление заказа</Link>
          </div>
          <div className="footer-contacts">
            <p className="footer-label">Контакты</p>
            {config.data?.phone ? (
              <a href={`tel:${config.data.phone.replace(/[^+\d]/g, '')}`}>
                <Phone size={14} aria-hidden="true" /> {config.data.phone}
              </a>
            ) : (
              <span>Ежедневно с 09:00 до 21:00</span>
            )}
            {config.data?.address ? (
              <span><MapPin size={14} aria-hidden="true" /> {config.data.address}</span>
            ) : (
              <span>Самовывоз и курьерская доставка</span>
            )}
            <Link to="/admin/login" className="admin-link">
              <LockKeyhole size={13} aria-hidden="true" /> Вход для администратора
            </Link>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} {config.data?.storeName || 'ЦветоТишина'}</span>
          <span>Спокойный ритм. Внимание к каждому стеблю.</span>
        </div>
      </footer>
      <CartDrawer />
      <MobileCartBar />
    </div>
  );
}
