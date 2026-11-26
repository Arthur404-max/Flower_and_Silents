import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, ClipboardList, KeyRound, LayoutDashboard, LogOut, Menu, Package, Shapes, X } from 'lucide-react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { useAdminMe } from '../hooks/useQueries';
import { adminLogout } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { Logo } from './Logo';

const navigation = [
  { to: '/admin', label: 'Обзор', icon: LayoutDashboard, end: true },
  { to: '/admin/products', label: 'Товары', icon: Package },
  { to: '/admin/categories', label: 'Категории', icon: Shapes },
  { to: '/admin/orders', label: 'Заказы', icon: ClipboardList },
  { to: '/admin/account', label: 'Пароль', icon: KeyRound },
];

export function AdminLayout() {
  const session = useAdminMe();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const logout = useMutation({
    mutationFn: adminLogout,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['admin'] });
      showToast('Вы вышли из админ-панели.', 'success');
      navigate('/admin/login', { replace: true });
    },
    onError: (error) => showToast(errorMessage(error, 'Не удалось завершить сессию.'), 'error'),
  });

  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar ${menuOpen ? 'admin-sidebar-open' : ''}`}>
        <div className="admin-sidebar-top"><Logo compact /><button type="button" className="icon-button admin-menu-close" onClick={() => setMenuOpen(false)} aria-label="Закрыть меню"><X size={20} /></button></div>
        <div className="admin-workspace"><span className="demo-dot" /><div><strong>ЦветоТишина</strong><small>Панель управления</small></div></div>
        <nav className="admin-nav" aria-label="Навигация администратора">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setMenuOpen(false)} className={({ isActive }) => isActive ? 'admin-nav-link admin-nav-link-active' : 'admin-nav-link'}><Icon size={19} strokeWidth={1.7} aria-hidden="true" />{label}</NavLink>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <Link to="/" className="admin-store-link"><ArrowUpRight size={17} aria-hidden="true" /> Открыть витрину</Link>
          <div className="admin-user"><span className="admin-user-avatar">{session.data?.user.name.slice(0, 1).toUpperCase()}</span><div><strong>{session.data?.user.name}</strong><small>{session.data?.user.email}</small></div></div>
          <button type="button" className="admin-logout" onClick={() => logout.mutate()} disabled={logout.isPending}><LogOut size={17} aria-hidden="true" />{logout.isPending ? 'Выходим…' : 'Выйти'}</button>
        </div>
      </aside>
      {menuOpen && <button type="button" className="admin-sidebar-backdrop" onClick={() => setMenuOpen(false)} aria-label="Закрыть меню" />}
      <div className="admin-main">
        <header className="admin-topbar"><button type="button" className="icon-button admin-menu-button" onClick={() => setMenuOpen(true)} aria-label="Открыть меню"><Menu size={22} /></button><span>Панель управления</span><Link to="/" className="text-link">Витрина <ArrowUpRight size={16} aria-hidden="true" /></Link></header>
        <div className="admin-content"><Outlet /></div>
      </div>
    </div>
  );
}
