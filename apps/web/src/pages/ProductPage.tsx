import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, Flower2, PackageCheck, Ruler, ShoppingBag } from 'lucide-react';
import { formatMoney } from '@cvetotishina/shared';
import { Link, useParams } from 'react-router-dom';
import { DemoNotice } from '../components/DemoNotice';
import { ProductGrid } from '../components/ProductGrid';
import { QuantityControl } from '../components/QuantityControl';
import { SectionHeading } from '../components/StateViews';
import { SmartImage } from '../components/SmartImage';
import { MAX_CART_QUANTITY, useCart } from '../context/CartContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useStoreConfig } from '../hooks/useQueries';
import { getProduct, getProducts } from '../lib/api';

export function ProductPage() {
  const { slug = '' } = useParams();
  const { addItem } = useCart();
  const config = useStoreConfig();
  const [quantity, setQuantity] = useState(1);

  const productQuery = useQuery({
    queryKey: ['product', slug],
    queryFn: ({ signal }) => getProduct(slug, signal),
    retry: 1,
  });
  const product = productQuery.data;
  useDocumentTitle(product?.name ?? 'Букет');

  useEffect(() => setQuantity(1), [slug]);

  const relatedQuery = useQuery({
    queryKey: ['products', 'related', product?.category.slug, product?.id],
    queryFn: ({ signal }) => getProducts({ category: product?.category.slug, sort: 'popular', limit: 5 }, signal),
    enabled: Boolean(product),
  });
  const related = (relatedQuery.data?.items ?? []).filter((item) => item.id !== product?.id).slice(0, 4);

  return (
    <div className="product-page section">
      <div className="container">
        <nav className="breadcrumbs" aria-label="Хлебные крошки">
          <Link to="/catalog"><ArrowLeft size={15} aria-hidden="true" /> Каталог</Link>
          {product && <><span>/</span><Link to={`/catalog?category=${encodeURIComponent(product.category.slug)}`}>{product.category.name}</Link><span>/</span><span aria-current="page">{product.name}</span></>}
        </nav>
        {productQuery.isLoading ? (
          <div className="product-detail-skeleton" aria-label="Загрузка букета" aria-busy="true"><div className="skeleton skeleton-product-photo" /><div><div className="skeleton skeleton-line" /><div className="skeleton skeleton-heading" /><div className="skeleton skeleton-line" /><div className="skeleton skeleton-line" /></div></div>
        ) : productQuery.error ? (
          <div className="state-card state-error" role="alert"><h1>Букет не открылся</h1><p>{productQuery.error instanceof Error ? productQuery.error.message : 'Попробуйте ещё раз.'}</p><button type="button" className="button button-secondary" onClick={() => void productQuery.refetch()}>Повторить</button></div>
        ) : product ? (
          <>
            <div className="product-detail">
              <div className="product-detail-visual">
                <SmartImage src={product.imageUrl} alt={product.name} loading="eager" />
                {product.badge && <span className="product-badge product-badge-large">{product.badge}</span>}
              </div>
              <div className="product-detail-info">
                <p className="eyebrow">{product.category.name}</p>
                <h1>{product.name}</h1>
                <p className="product-detail-description">{product.description}</p>
                <div className="product-detail-price"><strong>{formatMoney(product.price)}</strong>{product.oldPrice !== null && product.oldPrice > product.price && <del>{formatMoney(product.oldPrice)}</del>}</div>
                <dl className="product-facts">
                  <div><dt><Flower2 size={18} aria-hidden="true" /> Состав</dt><dd>{product.composition || 'Состав уточняется'}</dd></div>
                  <div><dt><Ruler size={18} aria-hidden="true" /> Размер</dt><dd>{product.size}</dd></div>
                  <div><dt><PackageCheck size={18} aria-hidden="true" /> Остаток</dt><dd className={product.stock > 0 ? 'in-stock' : 'out-stock'}>{product.stock > 0 ? `Доступно: ${product.stock}` : 'Нет в наличии'}</dd></div>
                </dl>
                <div className="product-purchase">
                  <QuantityControl value={quantity} onChange={setQuantity} max={Math.max(1, Math.min(product.stock, MAX_CART_QUANTITY))} disabled={product.stock < 1} label="Количество букетов" />
                  <button type="button" className="button button-primary button-large" disabled={product.stock < 1} onClick={() => addItem(product, quantity)}>
                    <ShoppingBag size={19} aria-hidden="true" /> {product.stock > 0 ? 'Добавить в корзину' : 'Нет в наличии'}
                  </button>
                </div>
                <ul className="purchase-notes"><li><Check size={16} aria-hidden="true" /> Итог пересчитается перед оформлением</li><li><Check size={16} aria-hidden="true" /> Корзина сохранится на устройстве</li></ul>
                <DemoNotice config={config.data} compact />
              </div>
            </div>
            <section className="related-section">
              <SectionHeading eyebrow="В том же настроении" title="Похожие букеты" description="Другие товары из этой категории." action={<Link to={`/catalog?category=${encodeURIComponent(product.category.slug)}`} className="text-link">Вся категория <ArrowRight size={17} /></Link>} />
              <ProductGrid products={related} isLoading={relatedQuery.isLoading} error={relatedQuery.error} onRetry={() => void relatedQuery.refetch()} emptyTitle="Пока только этот букет" emptyDescription="Загляните в другие категории — там может быть что-то ваше." />
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
