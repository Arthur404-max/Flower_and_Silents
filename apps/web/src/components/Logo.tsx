import { Link } from 'react-router-dom';

export function FlowerMark({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M24 40V23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M24 31c-7 0-12-5-12-12 7 0 12 5 12 12Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M24 27c0-7 5-12 12-12 0 7-5 12-12 12Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M24 22c-6-3-8-9-4-14 5 3 8 8 4 14Z" fill="currentColor" opacity=".9" />
      <path d="M24 22c3-6 9-8 14-4-3 5-8 8-14 4Z" fill="currentColor" opacity=".65" />
      <path d="M24 22c-3-6 0-12 6-14 3 5 0 11-6 14Z" fill="currentColor" opacity=".45" />
      <path d="M24 22c6-3 12 0 14 6-5 3-11 0-14-6Z" fill="currentColor" opacity=".8" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className={`logo ${compact ? 'logo-compact' : ''}`} aria-label="Flower2 — на главную">
      <span className="logo-mark"><FlowerMark /></span>
      <span className="logo-type">Flower<span>2</span></span>
    </Link>
  );
}
