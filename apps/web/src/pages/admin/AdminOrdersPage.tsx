import { useState } from 'react';
import type { FormEvent } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ArrowDown, Search } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from '@cvetotishina/shared';
import { AdminOrderTable } from '../../components/admin/AdminOrderTable';
import { EmptyState, ErrorState } from '../../components/StateViews';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { getAdminOrders } from '../../lib/api';

export function AdminOrdersPage() {
  useDocumentTitle('Заказы');
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') ?? '';
  const urlQuery = searchParams.get('q') ?? '';
  const [search, setSearch] = useState(urlQuery);
  const debouncedSearch = useDebouncedValue(search);
  const orders = useInfiniteQuery({
    queryKey: ['admin', 'orders', 'list', debouncedSearch, status],
    queryFn: ({ pageParam, signal }) => getAdminOrders({ q: debouncedSearch, status, cursor: pageParam, limit: 20 }, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    retry: 1,
  });
  const items = orders.data?.pages.flatMap((page) => page.items) ?? [];

  const updateFilters = (nextQuery: string, nextStatus: string) => {
    const next = new URLSearchParams();
    if (nextQuery.trim()) next.set('q', nextQuery.trim());
    if (nextStatus) next.set('status', nextStatus);
    setSearchParams(next, { preventScrollReset: true });
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateFilters(search, status);
  };

  return (
    <div className="admin-page">
      <header className="admin-page-header"><div><p className="eyebrow">Продажи</p><h1>Заказы</h1><p>Поиск, фильтр по статусу и история изменений.</p></div><span className="admin-total-pill">Всего: {orders.data?.pages[0]?.total ?? '—'}</span></header>
      <div className="admin-toolbar admin-orders-toolbar">
        <form className="admin-search" role="search" onSubmit={submit}><Search size={18} aria-hidden="true" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Номер, имя или телефон" aria-label="Поиск заказов" /><button type="submit" className="text-button">Найти</button></form>
        <label className="sort-control"><span className="sr-only">Статус заказа</span><select value={status} onChange={(event) => updateFilters(search, event.target.value)}><option value="">Все статусы</option>{ORDER_STATUSES.map((value) => <option key={value} value={value}>{ORDER_STATUS_LABELS[value]}</option>)}</select></label>
      </div>
      {orders.isLoading ? <div className="admin-loading-block" role="status">Загружаем заказы…</div> : orders.error && !items.length ? <ErrorState error={orders.error} onRetry={() => void orders.refetch()} /> : items.length ? (
        <>
          <AdminOrderTable orders={items} />
          {orders.hasNextPage && <div className="load-more-wrap"><button type="button" className="button button-secondary" onClick={() => void orders.fetchNextPage()} disabled={orders.isFetchingNextPage}>{orders.isFetchingNextPage ? 'Загружаем…' : 'Показать ещё'} <ArrowDown size={17} /></button></div>}
          {orders.error && <div className="inline-error" role="alert">Не удалось загрузить следующую страницу. <button type="button" onClick={() => void orders.refetch()}>Повторить</button></div>}
        </>
      ) : <EmptyState title="Заказов не найдено" description="Измените поиск или статус. Новые заказы появятся здесь автоматически." action={<button type="button" className="button button-secondary" onClick={() => { setSearch(''); updateFilters('', ''); }}>Сбросить фильтры</button>} />}
    </div>
  );
}
