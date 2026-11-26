import { AlertCircle, ArrowRight, Flower2, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../lib/errors';

export function PageLoader({ label = 'Собираем вашу витрину…' }: { label?: string }) {
  return (
    <div className="page-loader" role="status">
      <span className="loader-flower"><Flower2 size={30} aria-hidden="true" /></span>
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  title = 'Не получилось загрузить',
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <div className="state-card state-error" role="alert">
      <span className="state-icon"><AlertCircle size={26} aria-hidden="true" /></span>
      <h2>{title}</h2>
      <p>{errorMessage(error)}</p>
      {onRetry && (
        <button type="button" className="button button-secondary" onClick={onRetry}>
          <RefreshCw size={17} aria-hidden="true" /> Попробовать снова
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="state-card">
      <span className="state-icon"><Flower2 size={28} aria-hidden="true" /></span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action ?? <Link to="/catalog" className="button button-secondary">Перейти в каталог <ArrowRight size={17} aria-hidden="true" /></Link>}
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="product-grid" aria-label="Загрузка товаров" aria-busy="true">
      {Array.from({ length: count }, (_, index) => (
        <div className="product-card product-card-skeleton" key={index}>
          <div className="skeleton skeleton-image" />
          <div className="skeleton skeleton-line skeleton-line-short" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line skeleton-line-medium" />
        </div>
      ))}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        {description && <p className="section-description">{description}</p>}
      </div>
      {action}
    </div>
  );
}
