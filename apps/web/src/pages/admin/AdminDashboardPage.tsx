import { useQueries, useQuery } from '@tanstack/react-query';
import { ArrowRight, ClipboardList, CreditCard, Flower2, Package, PackageCheck, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { OrderStatus } from '../../types';
import { AdminOrderTable } from '../../components/admin/AdminOrderTable';
import { ErrorState } from '../../components/StateViews';
import { useAdminMe } from '../../hooks/useQueries';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { getAdminOrders } from '../../lib/api';

const summaryStatuses: OrderStatus[] = ['AWAITING_PAYMENT', 'NEW', 'ASSEMBLING', 'DELIVERING', 'DELIVERED'];

export function AdminDashboardPage() {
  useDocumentTitle('Панель управления');
  const session = useAdminMe();
  const recent = useQuery({
    queryKey: ['admin', 'orders', 'recent'],
    queryFn: ({ signal }) => getAdminOrders({ limit: 6 }, signal),
  });
  const statusQueries = useQueries({
    queries: summaryStatuses.map((status) => ({
      queryKey: ['admin', 'orders', 'summary', status],
      queryFn: ({ signal }: { signal: AbortSignal }) => getAdminOrders({ status, limit: 1 }, signal),
      staleTime: 30_000,
    })),
  });
  const totalFor = (status: OrderStatus): number | null => {
    const index = summaryStatuses.indexOf(status);
    return statusQueries[index]?.data?.total ?? null;
  };
  const inProgressValues = (['NEW', 'ASSEMBLING', 'DELIVERING'] as OrderStatus[]).map(totalFor);
  const inProgress = inProgressValues.every((value) => value !== null)
    ? inProgressValues.reduce<number>((sum, value) => sum + (value ?? 0), 0)
    : null;

  return (
    <div className="admin-page">
      <header className="admin-page-header"><div><p className="eyebrow">Обзор</p><h1>Здравствуйте, {session.data?.user.name}</h1><p>Короткая сводка заказов и быстрые переходы.</p></div><Link to="/admin/products" className="button button-primary"><Plus size={17} aria-hidden="true" /> Управлять товарами</Link></header>
      <div className="admin-metrics">
        <MetricCard icon={ClipboardList} label="Всего заказов" value={recent.data?.total ?? null} to="/admin/orders" />
        <MetricCard icon={CreditCard} label="Ожидают оплаты" value={totalFor('AWAITING_PAYMENT')} to="/admin/orders?status=AWAITING_PAYMENT" tone="warning" />
        <MetricCard icon={Package} label="В работе" value={inProgress} to="/admin/orders" />
        <MetricCard icon={PackageCheck} label="Доставлены" value={totalFor('DELIVERED')} to="/admin/orders?status=DELIVERED" tone="success" />
      </div>
      <div className="admin-dashboard-grid">
        <section className="admin-panel admin-recent-panel">
          <div className="admin-panel-heading"><div><h2>Последние заказы</h2><p>Последние поступившие заказы</p></div><Link to="/admin/orders" className="text-link">Все заказы <ArrowRight size={16} /></Link></div>
          {recent.isLoading ? <div className="admin-loading-block" role="status">Загружаем заказы…</div> : recent.error ? <ErrorState error={recent.error} onRetry={() => void recent.refetch()} /> : recent.data?.items.length ? <AdminOrderTable orders={recent.data.items} /> : <div className="admin-empty-compact">Заказов пока нет.</div>}
        </section>
        <aside className="admin-panel admin-quick-panel">
          <div className="admin-panel-heading"><div><h2>Быстрые действия</h2><p>Основные разделы панели</p></div></div>
          <Link to="/admin/products" className="admin-quick-link"><span><Package size={20} /></span><div><strong>Товары</strong><small>Создать, изменить или архивировать</small></div><ArrowRight size={17} /></Link>
          <Link to="/admin/categories" className="admin-quick-link"><span><Flower2 size={20} /></span><div><strong>Категории</strong><small>Порядок и названия разделов</small></div><ArrowRight size={17} /></Link>
          <Link to="/admin/orders?status=AWAITING_PAYMENT" className="admin-quick-link"><span><CreditCard size={20} /></span><div><strong>Ожидают оплаты</strong><small>Проверить заказы</small></div><ArrowRight size={17} /></Link>
          <div className="admin-demo-note">Покупательские токены доступа не отображаются.</div>
        </aside>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, to, tone = 'default' }: { icon: typeof ClipboardList; label: string; value: number | null; to: string; tone?: 'default' | 'warning' | 'success' }) {
  return (
    <Link to={to} className={`admin-metric admin-metric-${tone}`}>
      <span className="admin-metric-icon"><Icon size={21} strokeWidth={1.7} aria-hidden="true" /></span>
      <span className="admin-metric-value">{value ?? '—'}</span>
      <span className="admin-metric-label">{label}<ArrowRight size={16} aria-hidden="true" /></span>
    </Link>
  );
}
