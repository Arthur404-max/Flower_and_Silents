import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, LockKeyhole, MapPin, Menu, Search, ShoppingBag, Truck, X } from 'lucide-react';
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

  return (
    <div className="storefront-shell">
      <a href="#main-content" className="skip-link">Перейти к содержимому</a>
      <div className="demo-strip">
        <span><span className="demo-dot" /> Демонстрационный магазин</span>
        <span className="demo-strip-detail">Оплата не списывает деньги</span>
      </div>
      <header className="site-header">
        <div className="container header-main">
          <div className="brand-lockup">
            <Logo />
            <span className="brand-divider" />
            <span className="brand-name">{config.data?.storeName || 'ЦветоТишина'}</span>
          </div>
          <nav className={`main-nav ${menuOpen ? 'main-nav-open' : ''}`} aria-label="Основная навигация">
            <NavLink to="/" end>Главная</NavLink>
            <NavLink to="/catalog">Каталог</NavLink>
            <NavLink to="/how-it-works">Как это работает</NavLink>
          </nav>
          <form className="header-search" role="search" onSubmit={submitSearch}>
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Найти букет"
              aria-label="Поиск по каталогу"
            />
            {search && <button type="button" onClick={() => setSearch('')} aria-label="Очистить поиск"><X size={16} aria-hidden="true" /></button>}
          </form>
          <div className="header-actions">
            <Link to="/catalog" className="delivery-pill" title={config.data?.address ?? 'Условия демо-доставки'}>
              <Truck size={18} aria-hidden="true" />
              <span>Демо-доставка</span>
            </Link>
            <Link to={itemCount > 0 ? '/checkout' : '/catalog'} className="button button-primary header-order">
              Заказать <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <button type="button" className="cart-button" onClick={openDrawer} aria-label={`Открыть корзину, товаров: ${itemCount}`}>
              <ShoppingBag size={21} aria-hidden="true" />
              {itemCount > 0 && <span>{itemCount > 99 ? '99+' : itemCount}</span>}
            </button>
            <button type="button" className="menu-button icon-button" onClick={() => setMenuOpen((value) => !value)} aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'} aria-expanded={menuOpen}>
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
        <form className="container mobile-search" role="search" onSubmit={submitSearch}>
          <Search size={18} aria-hidden="true" />
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Найти букет" aria-label="Поиск по каталогу" />
          <button type="submit" className="icon-button" aria-label="Найти"><ArrowRight size={18} /></button>
        </form>
      </header>
      <main id="main-content">
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container footer-top">
          <div className="footer-brand">
            <Logo />
            <p>Цветы, после которых становится тише.</p>
            <span className="footer-demo">Демо-проект · не является действующим магазином</span>
          </div>
          <div className="footer-links">
            <p className="footer-label">Прогуляться</p>
            <Link to="/catalog">Все букеты</Link>
            <Link to="/how-it-works">Как это работает</Link>
            <Link to="/checkout">Оформление заказа</Link>
          </div>
          <div className="footer-contacts">
            <p className="footer-label">Контакты</p>
            {config.data?.phone ? <a href={`tel:${config.data.phone}`}>{config.data.phone}</a> : <span>Контакты будут добавлены</span>}
            {config.data?.address ? <span><MapPin size={15} aria-hidden="true" /> {config.data.address}</span> : <span>Адрес также появится здесь</span>}
            <Link to="/admin/login" className="admin-link"><LockKeyhole size={14} aria-hidden="true" /> Вход для администратора</Link>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} ЦветоТишина</span>
          <span>Спокойный интерфейс. Демонстрационные заказы.</span>
        </div>
      </footer>
      <CartDrawer />
      <MobileCartBar />
    </div>
  );
}
