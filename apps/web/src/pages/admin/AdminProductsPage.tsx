import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArchiveRestore, Edit3, Plus, Search } from 'lucide-react';
import { formatMoney } from '@cvetotishina/shared';
import { ProductEditor } from '../../components/admin/ProductEditor';
import { EmptyState, ErrorState } from '../../components/StateViews';
import { SmartImage } from '../../components/SmartImage';
import { useToast } from '../../context/ToastContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { archiveAdminProduct, getAdminCategories, getAdminProducts } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import type { AdminProduct } from '../../types';

export function AdminProductsPage() {
  useDocumentTitle('Товары');
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [editing, setEditing] = useState<AdminProduct | null | undefined>(undefined);

  const categories = useQuery({ queryKey: ['admin', 'categories'], queryFn: ({ signal }) => getAdminCategories(signal) });
  const products = useQuery({
    queryKey: ['admin', 'products', debouncedSearch],
    queryFn: ({ signal }) => getAdminProducts(debouncedSearch, signal),
  });
  const archive = useMutation({
    mutationFn: archiveAdminProduct,
    onSuccess: ({ isActive }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      showToast(isActive ? 'Товар восстановлен.' : 'Товар архивирован.', 'success');
    },
    onError: (error) => showToast(errorMessage(error, 'Не удалось изменить статус товара.'), 'error'),
  });

  const saved = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
    setEditing(undefined);
  };
  const categoryName = (id: string) => categories.data?.find((category) => category.id === id)?.name ?? 'Категория';

  return (
    <div className="admin-page">
      <header className="admin-page-header"><div><p className="eyebrow">Каталог</p><h1>Товары</h1><p>Создание, редактирование, архивирование и восстановление демо-товаров.</p></div><button type="button" className="button button-primary" onClick={() => setEditing(null)} disabled={!categories.data?.length}><Plus size={17} /> Добавить товар</button></header>
      <div className="admin-toolbar"><label className="admin-search"><Search size={18} aria-hidden="true" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по названию" aria-label="Поиск товаров" /></label><span>{products.data?.length ?? 0} товаров</span></div>
      {categories.error && <div className="form-error" role="alert">{errorMessage(categories.error, 'Не удалось загрузить категории.')}</div>}
      {products.isLoading ? <div className="admin-loading-block" role="status">Загружаем товары…</div> : products.error ? <ErrorState error={products.error} onRetry={() => void products.refetch()} /> : products.data?.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table admin-products-table">
            <thead><tr><th>Товар</th><th>Категория</th><th>Цена</th><th>Остаток</th><th>Версия</th><th><span className="sr-only">Действия</span></th></tr></thead>
            <tbody>{products.data.map((product) => (
              <tr key={product.id}>
                <td><div className="admin-product-cell"><SmartImage src={product.imageUrl} alt="" loading="lazy" /><div><strong>{product.name}</strong><span>{product.size}{product.badge ? ` · ${product.badge}` : ''}</span></div></div></td>
                <td>{categoryName(product.categoryId)}</td>
                <td><strong>{formatMoney(product.price)}</strong>{product.oldPrice !== null && <span className="table-secondary"><del>{formatMoney(product.oldPrice)}</del></span>}</td>
                <td><span className={product.stock > 0 ? 'stock-pill' : 'stock-pill stock-pill-empty'}>{product.stock > 0 ? product.stock : 'Нет'}</span></td>
                <td><code>v{product.version}</code></td>
                <td><div className="table-actions"><button type="button" className="icon-button" onClick={() => setEditing(product)} aria-label={`Редактировать ${product.name}`}><Edit3 size={17} /></button><button type="button" className="icon-button icon-button-danger" disabled={archive.isPending} onClick={() => { if (window.confirm(`${product.isActive ? 'Архивировать' : 'Восстановить'} «${product.name}»?`)) archive.mutate(product.id); }} aria-label={`${product.isActive ? 'Архивировать' : 'Восстановить'} ${product.name}`}>{product.isActive ? <Archive size={17} /> : <ArchiveRestore size={17} />}</button></div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <EmptyState title={search ? 'Товары не найдены' : 'Каталог пока пуст'} description={search ? 'Измените поисковый запрос.' : 'Создайте первый демо-товар.'} action={<button type="button" className="button button-secondary" onClick={() => setEditing(null)}><Plus size={17} /> Добавить товар</button>} />}
      {editing !== undefined && categories.data && <ProductEditor key={editing?.id ?? 'new'} product={editing} categories={categories.data} onClose={() => setEditing(undefined)} onSaved={saved} />}
    </div>
  );
}
