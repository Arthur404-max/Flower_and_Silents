import type { ProductView } from '../types';
import { ProductCard } from './ProductCard';
import { EmptyState, ErrorState, ProductGridSkeleton } from './StateViews';

export function ProductGrid({
  products,
  isLoading,
  error,
  onRetry,
  emptyTitle = 'Здесь пока тихо',
  emptyDescription = 'Попробуйте изменить запрос или выбрать другую категорию.',
}: {
  products: ProductView[];
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (isLoading) return <ProductGridSkeleton />;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (products.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  return (
    <div className="product-grid">
      {products.map((product) => <ProductCard key={product.id} product={product} />)}
    </div>
  );
}
