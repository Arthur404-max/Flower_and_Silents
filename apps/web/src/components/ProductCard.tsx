import { ArrowUpRight, Plus } from 'lucide-react';
import { formatMoney } from '@cvetotishina/shared';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import type { ProductView } from '../types';
import { SmartImage } from './SmartImage';

export function ProductCard({ product }: { product: ProductView }) {
  const { addItem } = useCart();
  const unavailable = product.stock < 1;

  return (
    <article className="product-card">
      <Link to={`/product/${product.slug}`} className="product-card-image" aria-label={`Открыть ${product.name}`}>
        <SmartImage src={product.imageUrl} alt={product.name} loading="lazy" />
        {product.badge && <span className="product-badge">{product.badge}</span>}
        <span className="product-open" aria-hidden="true"><ArrowUpRight size={17} strokeWidth={1.7} /></span>
      </Link>
      <div className="product-card-body">
        <p className="product-category">{product.category.name}</p>
        <Link to={`/product/${product.slug}`} className="product-name">{product.name}</Link>
        <p className="product-size">{product.size}</p>
        <div className="product-card-bottom">
          <div className="product-price">
            <strong>{formatMoney(product.price)}</strong>
            {product.oldPrice !== null && product.oldPrice > product.price && <del>{formatMoney(product.oldPrice)}</del>}
          </div>
          <button
            type="button"
            className="product-add"
            disabled={unavailable}
            onClick={() => addItem(product)}
            aria-label={unavailable ? `${product.name} нет в наличии` : `Добавить ${product.name} в корзину`}
          >
            <Plus size={18} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
        {unavailable && <p className="stock-note stock-empty">Нет в наличии</p>}
      </div>
    </article>
  );
}
