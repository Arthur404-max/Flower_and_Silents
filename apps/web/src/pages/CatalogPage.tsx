import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ArrowDown, Search, SlidersHorizontal, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { ProductGrid } from '../components/ProductGrid';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { getCategories, getProducts } from '../lib/api';
import { errorMessage } from '../lib/errors';
import type { ProductSort } from '../types';

const sortOptions: Array<{ value: ProductSort; label: string }> = [
  { value: 'popular', label: 'Сначала популярные' },
  { value: 'price-asc', label: 'Сначала дешевле' },
  { value: 'price-desc', label: 'Сначала дороже' },
  { value: 'newest', label: 'Сначала новые' },
];

function readSort(value: string | null): ProductSort {
  return sortOptions.some((option) => option.value === value) ? (value as ProductSort) : 'popular';
}

export function CatalogPage() {
  useDocumentTitle('Каталог букетов');
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const category = searchParams.get('category') ?? '';
  const sort = readSort(searchParams.get('sort'));
  const [searchInput, setSearchInput] = useState(query);

  useEffect(() => setSearchInput(query), [query]);

  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: ({ signal }) => getCategories(signal),
    staleTime: 5 * 60 * 1000,
  });
  const products = useInfiniteQuery({
    queryKey: ['products', 'catalog', query, category, sort],
    queryFn: ({ pageParam, signal }) =>
      getProducts({ q: query, category, sort, cursor: pageParam, limit: 12 }, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    retry: 1,
  });

  const items = products.data?.pages.flatMap((page) => page.items) ?? [];

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'sort' && !next.has('sort')) next.set('sort', 'popular');
    setSearchParams(next, { preventScrollReset: true });
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateParam('q', searchInput.trim());
  };

  const resetFilters = () => {
    setSearchInput('');
    setSearchParams({ sort: 'popular' }, { preventScrollReset: true });
  };

  return (
    <div className="catalog-page">
      <section className="page-intro section-small">
        <div className="container">
          <p className="eyebrow">Демо-каталог</p>
          <h1>Найдите свой <em>букет</em></h1>
          <p>Спокойный выбор по категориям, цене и настроению. Все карточки загружаются из API.</p>
        </div>
      </section>
      <section className="container catalog-content">
        <div className="catalog-toolbar">
          <form className="catalog-search" role="search" onSubmit={submitSearch}>
            <Search size={20} aria-hidden="true" />
            <input type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Название или описание" aria-label="Поиск по каталогу" />
            {searchInput && <button type="button" className="icon-button" onClick={() => { setSearchInput(''); updateParam('q', ''); }} aria-label="Очистить поиск"><X size={17} /></button>}
            <button type="submit" className="button button-secondary">Найти</button>
          </form>
          <label className="sort-control">
            <SlidersHorizontal size={18} aria-hidden="true" />
            <span className="sr-only">Сортировка</span>
            <select value={sort} onChange={(event) => updateParam('sort', event.target.value)} aria-label="Сортировка товаров">
              {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
        {categories.error && <div className="inline-error catalog-category-error" role="alert">Категории недоступны: {errorMessage(categories.error)} <button type="button" onClick={() => void categories.refetch()}>Повторить</button></div>}
        <div className="category-filters" aria-label="Фильтр по категории">
          <button type="button" className={!category ? 'filter-chip filter-chip-active' : 'filter-chip'} onClick={() => updateParam('category', '')}>Все категории</button>
          {categories.data?.map((item) => (
            <button key={item.id} type="button" className={category === item.slug ? 'filter-chip filter-chip-active' : 'filter-chip'} onClick={() => updateParam('category', item.slug)}>{item.name}</button>
          ))}
        </div>
        <div className="catalog-result-bar">
          <p>{products.isLoading ? 'Загружаем букеты…' : `Показано: ${items.length}`}</p>
          {(query || category || sort !== 'popular') && <button type="button" className="text-button" onClick={resetFilters}>Сбросить фильтры</button>}
        </div>
        <ProductGrid
          products={items}
          isLoading={products.isLoading}
          error={products.error}
          onRetry={() => void products.refetch()}
          emptyTitle={query ? 'По вашему запросу ничего не нашли' : 'В этой категории пока нет букетов'}
          emptyDescription="Попробуйте другой запрос или вернитесь ко всему каталогу."
        />
        {products.hasNextPage && (
          <div className="load-more-wrap">
            <button type="button" className="button button-secondary button-large" onClick={() => void products.fetchNextPage()} disabled={products.isFetchingNextPage}>
              {products.isFetchingNextPage ? 'Загружаем…' : 'Показать ещё'} <ArrowDown size={18} aria-hidden="true" />
            </button>
          </div>
        )}
        {products.error && items.length > 0 && <div className="inline-error" role="alert">Не удалось загрузить следующую страницу. <button type="button" onClick={() => void products.refetch()}>Повторить</button></div>}
      </section>
    </div>
  );
}
