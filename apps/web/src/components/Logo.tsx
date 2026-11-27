import { Link } from 'react-router-dom';

export function FlowerMark({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M24 42V22" />
        <path d="M24 34c-6 0-10-4-10-9.5 6 0 10 4 10 9.5Z" />
        <path d="M24 29.5c0-5.5 4-9.5 10-9.5 0 5.5-4 9.5-10 9.5Z" />
        <path d="M24 21c-4-2-5.4-6.6-2.7-10.6 3.4 2 5 6.6 2.7 10.6Z" />
        <path d="M24 21c4-2 5.4-6.6 2.7-10.6-3.4 2-5 6.6-2.7 10.6Z" />
      </g>
    </svg>
  );
}

export function Logo({ compact = false, onClick }: { compact?: boolean; onClick?: () => void }) {
  return (
    <Link to="/" className={`logo ${compact ? 'logo-compact' : ''}`} aria-label="ЦветоТишина — на главную" onClick={onClick}>
      <FlowerMark className="logo-mark" />
      <span className="logo-type">Цвето<span>Тишина</span></span>
    </Link>
  );
}
